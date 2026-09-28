import type { Message, MessageReplyOptions } from 'discord.js';
import { buildAboutEmbed } from '../commands/about.js';
import { buildConvertEmbed } from '../commands/convert.js';
import { currencyReply, matchesForQuery } from '../commands/currency.js';
import { buildHelpEmbed } from '../commands/help.js';
import { buildRateEmbed } from '../commands/rate.js';
import type { CurrencyService } from '../services/currencyService.js';
import { toUserMessage } from '../utils/errorHandler.js';
import { UserFacingError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import {
  CONVERT_USAGE_MESSAGE,
  COOLDOWN_MESSAGE,
  RATE_USAGE_MESSAGE,
  UNKNOWN_COMMAND_MESSAGE,
} from '../utils/messages.js';
import type { Cooldown } from '../utils/cooldown.js';
import { validateAmount } from '../utils/validation.js';
import { parsePrefixCommand, readKeyedArgs } from './parse.js';

interface PrefixDeps {
  service: CurrencyService;
  cooldown: Cooldown;
}

type ReplyBody = Omit<MessageReplyOptions, 'allowedMentions'>;

export function createPrefixHandler(deps: PrefixDeps) {
  return async function handlePrefixMessage(message: Message): Promise<void> {
    if (message.author.bot) return;

    const parsed = parsePrefixCommand(message.content);
    if (!parsed) return;

    try {
      await runPrefixCommand(message, parsed.name, parsed.args, deps);
    } catch (error) {
      if (!(error instanceof UserFacingError)) {
        logger.error('Prefix command failed', error);
      }
      await replyTo(message, { content: toUserMessage(error) });
    }
  };
}

async function runPrefixCommand(
  message: Message,
  name: string,
  args: string[],
  deps: PrefixDeps,
): Promise<void> {
  switch (name) {
    case 'help':
      await replyTo(message, { embeds: [buildHelpEmbed()] });
      return;
    case 'about':
      await replyTo(message, { embeds: [buildAboutEmbed()] });
      return;
    case 'currency':
      await replyCurrency(message, args, deps.service);
      return;
    case 'convert':
      await replyConvert(message, args, deps);
      return;
    case 'rate':
      await replyRate(message, args, deps);
      return;
    default:
      await replyTo(message, { content: UNKNOWN_COMMAND_MESSAGE });
  }
}

async function replyConvert(message: Message, args: string[], deps: PrefixDeps): Promise<void> {
  const input = readConvertInput(args);
  if (!input) {
    await replyTo(message, { content: CONVERT_USAGE_MESSAGE });
    return;
  }

  const amountCheck = validateAmount(input.amount);
  if (!amountCheck.ok) {
    await replyTo(message, { content: amountCheck.message });
    return;
  }

  let from: string;
  let to: string;
  try {
    from = deps.service.normalizeSupported(input.from);
    to = deps.service.normalizeSupported(input.to);
  } catch (error) {
    await replyTo(message, { content: toUserMessage(error) });
    return;
  }

  if (!deps.cooldown.tryAcquire(message.author.id)) {
    await replyTo(message, { content: COOLDOWN_MESSAGE });
    return;
  }

  await showTyping(message);
  const result = await deps.service.convert(from, to, amountCheck.amount);
  await replyTo(message, { embeds: [buildConvertEmbed(result)] });
}

async function replyRate(message: Message, args: string[], deps: PrefixDeps): Promise<void> {
  const input = readRateInput(args);
  if (!input) {
    await replyTo(message, { content: RATE_USAGE_MESSAGE });
    return;
  }

  let from: string;
  let to: string;
  try {
    from = deps.service.normalizeSupported(input.from);
    to = deps.service.normalizeSupported(input.to);
  } catch (error) {
    await replyTo(message, { content: toUserMessage(error) });
    return;
  }

  if (!deps.cooldown.tryAcquire(message.author.id)) {
    await replyTo(message, { content: COOLDOWN_MESSAGE });
    return;
  }

  await showTyping(message);
  const rate = await deps.service.getRate(from, to);
  await replyTo(message, { embeds: [buildRateEmbed(rate)] });
}

async function replyCurrency(message: Message, args: string[], service: CurrencyService): Promise<void> {
  const request = readCurrencyRequest(args);
  if (!request) {
    await replyTo(message, {
      content: 'page numbers start at 1 cuh\n\nlike dis:\ncy!currency 2',
    });
    return;
  }

  if (!service.hasFreshCurrencies()) {
    await showTyping(message);
    try {
      await service.refreshCurrencies();
    } catch (error) {
      logger.error('Currency list refresh failed', error);
    }
  }

  const currencies = matchesForQuery(service, request.query);
  const listAvailable = service.getCurrencyList().length > 0;
  await replyTo(
    message,
    currencyReply(currencies, request.query, message.author.id, request.page, listAvailable),
  );
}

function readConvertInput(args: readonly string[]): { from: string; to: string; amount: string } | null {
  const keyed = readKeyedArgs(args);
  const from = keyed.from ?? keyed.positional[0];
  const to = keyed.to ?? keyed.positional[1];
  const amount = (keyed.amount ?? keyed.positional[2] ?? '').replace(/,/g, '');
  if (!from || !to || !amount) return null;
  return { from, to, amount };
}

function readRateInput(args: readonly string[]): { from: string; to: string } | null {
  const keyed = readKeyedArgs(args);
  const from = keyed.from ?? keyed.positional[0];
  const to = keyed.to ?? keyed.positional[1];
  if (!from || !to) return null;
  return { from, to };
}

function readCurrencyRequest(args: readonly string[]): { page: number; query: string } | null {
  if (args.length === 0) return { page: 0, query: '' };

  const onlyPage = args.length === 1 ? args[0] : undefined;
  if (onlyPage && /^\d+$/.test(onlyPage)) {
    const page = Number(onlyPage);
    if (!Number.isInteger(page) || page < 1) return null;
    return { page: page - 1, query: '' };
  }

  return { page: 0, query: args.join(' ').trim() };
}

async function showTyping(message: Message): Promise<void> {
  if (!message.channel.isSendable()) return;
  await message.channel.sendTyping().catch((error: unknown) => {
    logger.error('Failed to send a typing indicator', error);
  });
}

async function replyTo(message: Message, body: ReplyBody): Promise<void> {
  try {
    await message.reply({
      ...body,
      allowedMentions: { parse: [] },
    });
  } catch (error) {
    logger.error('Failed to reply to a prefix command', error);
  }
}

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  MessageFlags,
  SlashCommandBuilder,
  type ButtonInteraction,
} from 'discord.js';
import { CURRENCIES_PAGE_SIZE, RATE_SOURCE_NAME } from '../config.js';
import { autocompleteCurrencies } from './autocomplete.js';
import type { CurrencyService } from '../services/currencyService.js';
import type { Currency } from '../types/currency.js';
import type { Command } from '../types/command.js';
import { currencyDisplayName } from '../utils/currencyFormatter.js';
import { logger } from '../utils/logger.js';
import {
  CURRENCY_LIST_UNAVAILABLE_MESSAGE,
  CURRENCY_PAGE_OWNER_MESSAGE,
  currencySearchMissMessage,
} from '../utils/messages.js';

const EMBED_COLOR = 0x2db350;

export const currencyCommandData = new SlashCommandBuilder()
  .setName('currency')
  .setDescription('List currencies, or search by code or name.')
  .addStringOption((option) =>
    option
      .setName('search')
      .setDescription('Find a currency by code or name, such as MY or ringgit')
      .setRequired(false)
      .setAutocomplete(true),
  );

export function matchesForQuery(service: CurrencyService, query: string): Currency[] {
  const trimmed = query.trim();
  if (!trimmed) return service.getCurrencyList();
  return service.searchCurrencies(trimmed, 500);
}

export function buildCurrencyPayload(
  currencies: readonly Currency[],
  page: number,
  userId: string,
  query = '',
) {
  const trimmedQuery = query.trim();
  const pageCount = Math.max(1, Math.ceil(currencies.length / CURRENCIES_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 0), pageCount - 1);
  const start = safePage * CURRENCIES_PAGE_SIZE;
  const slice = currencies.slice(start, start + CURRENCIES_PAGE_SIZE);
  const lines = slice.map(
    (currency) => `${currency.code} — ${currencyDisplayName(currency.code, currency.name)}`,
  );

  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(trimmedQuery ? '☑️ SEARCH RESULTS' : '☑️ SUPPORTED CURRENCIES')
    .setDescription(lines.join('\n') || 'No currencies are loaded yet.')
    .setFooter({
      text: trimmedQuery
        ? `Matching "${trimmedQuery.slice(0, 40)}" · ${currencies.length} found · Page ${safePage + 1} of ${pageCount} · ${RATE_SOURCE_NAME}`
        : `Page ${safePage + 1} of ${pageCount} · ${currencies.length} currencies · ${RATE_SOURCE_NAME}`,
    });

  const components =
    pageCount === 1
      ? []
      : [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(currencyButtonId(userId, safePage - 1, trimmedQuery))
              .setLabel('Previous')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(safePage === 0),
            new ButtonBuilder()
              .setCustomId(currencyButtonId(userId, safePage + 1, trimmedQuery))
              .setLabel('Next')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(safePage >= pageCount - 1),
          ),
        ];

  return { embeds: [embed], components };
}

export function createCurrencyCommand(service: CurrencyService): Command {
  return {
    data: currencyCommandData,
    autocomplete: (interaction) => autocompleteCurrencies(interaction, service),
    async execute(interaction) {
      const search = interaction.options.getString('search')?.trim() ?? '';

      try {
        if (!service.hasFreshCurrencies()) {
          await interaction.deferReply();
          try {
            await service.refreshCurrencies();
          } catch (error) {
            logger.error('Currency list refresh failed', error);
          }
        }

        const listAvailable = service.getCurrencyList().length > 0;
        const currencies = matchesForQuery(service, search);
        const payload = currencyReply(currencies, search, interaction.user.id, 0, listAvailable);
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(payload);
        } else {
          await interaction.reply(payload);
        }
      } catch (error) {
        logger.error('Command /currency failed', error);
        const payload = { content: CURRENCY_LIST_UNAVAILABLE_MESSAGE, embeds: [], components: [] };
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(payload);
        } else {
          await interaction.reply(payload);
        }
      }
    },
  };
}

export async function handleCurrencyButton(
  interaction: ButtonInteraction,
  service: CurrencyService,
): Promise<void> {
  const parsed = parseCurrencyButtonId(interaction.customId);
  if (!parsed) return;

  if (interaction.user.id !== parsed.ownerId) {
    await interaction.reply({
      content: CURRENCY_PAGE_OWNER_MESSAGE,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const listAvailable = service.getCurrencyList().length > 0;
  const currencies = matchesForQuery(service, parsed.query);
  await interaction.update(
    currencyReply(currencies, parsed.query, parsed.ownerId, parsed.page, listAvailable),
  );
}

export function currencyReply(
  currencies: readonly Currency[],
  query: string,
  userId: string,
  page = 0,
  listAvailable = true,
) {
  if (query.trim() && currencies.length === 0 && listAvailable) {
    return { content: currencySearchMissMessage(query), embeds: [], components: [] };
  }

  if (currencies.length === 0) {
    return { content: CURRENCY_LIST_UNAVAILABLE_MESSAGE, embeds: [], components: [] };
  }

  return buildCurrencyPayload(currencies, page, userId, query);
}

function currencyButtonId(userId: string, page: number, query: string): string {
  const base = `yc:${userId}:${page}`;
  const trimmed = query.trim();
  if (!trimmed) return base;

  const room = 100 - base.length - 1;
  let encoded = encodeURIComponent(trimmed);
  if (encoded.length > room) {
    encoded = encoded.slice(0, Math.max(room, 0)).replace(/%(?:[0-9A-Fa-f]{0,1})$/, '');
  }
  return encoded ? `${base}:${encoded}` : base;
}

function parseCurrencyButtonId(customId: string): { ownerId: string; page: number; query: string } | null {
  const match = /^yc:(\d+):(-?\d+)(?::(.*))?$/.exec(customId);
  const ownerId = match?.[1];
  const pageText = match?.[2];
  if (!ownerId || pageText === undefined) return null;

  const page = Number(pageText);
  if (!Number.isInteger(page)) return null;

  const rawQuery = match[3] ?? '';
  let query = rawQuery;
  if (rawQuery) {
    try {
      query = decodeURIComponent(rawQuery);
    } catch {
      query = rawQuery;
    }
  }

  return { ownerId, page, query };
}

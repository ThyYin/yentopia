import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { CurrencyService } from '../services/currencyService.js';
import type { Command } from '../types/command.js';
import type { ConversionResult } from '../types/currency.js';
import { respondToChat } from '../discord/respond.js';
import { toUserMessage } from '../utils/errorHandler.js';
import { UserFacingError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import {
  formatExchangeRate,
  formatMoney,
  formatRateDate,
} from '../utils/currencyFormatter.js';
import { COOLDOWN_MESSAGE, UNKNOWN_CURRENCY_MESSAGE } from '../utils/messages.js';
import { validateAmount } from '../utils/validation.js';
import type { Cooldown } from '../utils/cooldown.js';
import { autocompleteCurrencies } from './autocomplete.js';

const EMBED_COLOR = 0x2db350;

export const convertCommandData = new SlashCommandBuilder()
  .setName('convert')
  .setDescription('Convert an amount from one currency to another.')
  .addStringOption((option) =>
    option
      .setName('from')
      .setDescription('Currency to convert from, such as MYR')
      .setRequired(true)
      .setAutocomplete(true),
  )
  .addStringOption((option) =>
    option
      .setName('to')
      .setDescription('Currency to convert to, such as USD')
      .setRequired(true)
      .setAutocomplete(true),
  )
  .addNumberOption((option) =>
    option.setName('amount').setDescription('How much money to convert').setRequired(true),
  );

export function buildConvertEmbed(result: ConversionResult): EmbedBuilder {
  const SET_TITLE = '💵 Convert: ' + result.from + ' -> ' + result.to;
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(SET_TITLE)
    .setDescription(
      `${formatMoney(result.amount, result.from)}\n≈ ${formatMoney(result.converted, result.to)}`,
    )
    .addFields({
      name: 'Exchange rate',
      value: formatExchangeRate(result.from, result.to, result.rate),
    });

  if (!result.sameCurrency && result.date) {
    embed.addFields(
      { name: 'Rate date', value: formatRateDate(result.date) },
      { name: 'Source', value: '[Frankfurter v2 API](https://frankfurter.dev/)'},
    );
    embed.setFooter({
      text: 'Reference rate. Banks, cards, and payment apps may use a different rate.',
    });
  }

  return embed;
}

export function createConvertCommand(service: CurrencyService, cooldown: Cooldown): Command {
  return {
    data: convertCommandData,
    autocomplete: (interaction) => autocompleteCurrencies(interaction, service),
    async execute(interaction) {
      const fromRaw = interaction.options.getString('from');
      const toRaw = interaction.options.getString('to');
      const amountRaw = interaction.options.getNumber('amount');
      const amountCheck = validateAmount(amountRaw);

      if (!fromRaw || !toRaw) {
        await respondToChat(interaction, UNKNOWN_CURRENCY_MESSAGE);
        return;
      }

      if (!amountCheck.ok) {
        await respondToChat(interaction, amountCheck.message);
        return;
      }

      let from: string;
      let to: string;
      try {
        from = service.normalizeSupported(fromRaw);
        to = service.normalizeSupported(toRaw);
      } catch (error) {
        await respondToChat(interaction, toUserMessage(error));
        return;
      }

      if (!cooldown.tryAcquire(interaction.user.id)) {
        await respondToChat(interaction, COOLDOWN_MESSAGE);
        return;
      }

      try {
        await interaction.deferReply();
        const result = await service.convert(from, to, amountCheck.amount);
        await respondToChat(interaction, { embeds: [buildConvertEmbed(result)] });
      } catch (error) {
        if (!(error instanceof UserFacingError)) {
          logger.error('Command /convert failed', error);
        }
        await respondToChat(interaction, toUserMessage(error));
      }
    },
  };
}

import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { CurrencyService } from '../services/currencyService.js';
import type { Command } from '../types/command.js';
import type { ExchangeRate } from '../types/currency.js';
import { respondToChat } from '../discord/respond.js';
import { toUserMessage } from '../utils/errorHandler.js';
import { UserFacingError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { formatExchangeRate, formatRateDate } from '../utils/currencyFormatter.js';
import { COOLDOWN_MESSAGE, UNKNOWN_CURRENCY_MESSAGE } from '../utils/messages.js';
import type { Cooldown } from '../utils/cooldown.js';
import { autocompleteCurrencies } from './autocomplete.js';

const EMBED_COLOR = 0x2db350;

export const rateCommandData = new SlashCommandBuilder()
  .setName('rate')
  .setDescription('Show the exchange rate between two currencies.')
  .addStringOption((option) =>
    option
      .setName('from')
      .setDescription('Base currency, such as MYR')
      .setRequired(true)
      .setAutocomplete(true),
  )
  .addStringOption((option) =>
    option
      .setName('to')
      .setDescription('Quote currency, such as USD')
      .setRequired(true)
      .setAutocomplete(true),
  );

export function buildRateEmbed(rate: ExchangeRate): EmbedBuilder {
  const SET_TITLE = '% Rate: ' + rate.from + ' -> ' + rate.to;
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle(SET_TITLE)
    .setDescription(formatExchangeRate(rate.from, rate.to, rate.rate));

  if (rate.date) {
    embed.addFields(
      { name: 'Rate date', value: formatRateDate(rate.date) },
      { name: 'Source', value: '[Frankfurter v2 API](https://frankfurter.dev/)' },
    );
    embed.setFooter({
      text: 'Reference rate. Banks, cards, and payment apps may use a different rate.',
    });
  }

  return embed;
}

export function createRateCommand(service: CurrencyService, cooldown: Cooldown): Command {
  return {
    data: rateCommandData,
    autocomplete: (interaction) => autocompleteCurrencies(interaction, service),
    async execute(interaction) {
      const fromRaw = interaction.options.getString('from');
      const toRaw = interaction.options.getString('to');

      if (!fromRaw || !toRaw) {
        await respondToChat(interaction, UNKNOWN_CURRENCY_MESSAGE);
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
        const rate = await service.getRate(from, to);
        await respondToChat(interaction, { embeds: [buildRateEmbed(rate)] });
      } catch (error) {
        if (!(error instanceof UserFacingError)) {
          logger.error('Command /rate failed', error);
        }
        await respondToChat(interaction, toUserMessage(error));
      }
    },
  };
}

import { MessageFlags, type Interaction } from 'discord.js';
import { handleCurrencyButton } from '../commands/currency.js';
import type { CurrencyService } from '../services/currencyService.js';
import type { Command } from '../types/command.js';
import { logger } from '../utils/logger.js';
import {
  CURRENCY_LIST_UNAVAILABLE_MESSAGE,
  GENERIC_RATE_MESSAGE,
  UNKNOWN_COMMAND_MESSAGE,
} from '../utils/messages.js';
import { respondToAutocomplete, respondToChat } from './respond.js';

export function createInteractionHandler(commands: Command[], service: CurrencyService) {
  const byName = new Map(commands.map((command) => [command.data.name, command]));

  return async function handleInteraction(interaction: Interaction): Promise<void> {
    try {
      if (interaction.isAutocomplete()) {
        const command = byName.get(interaction.commandName);
        if (!command?.autocomplete) {
          await respondToAutocomplete(interaction, []);
          return;
        }
        await command.autocomplete(interaction);
        return;
      }

      if (interaction.isButton()) {
        try {
          await handleCurrencyButton(interaction, service);
        } catch (error) {
          logger.error('Currency page update failed', error);
          if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
              content: CURRENCY_LIST_UNAVAILABLE_MESSAGE,
              flags: MessageFlags.Ephemeral,
            });
          }
        }
        return;
      }

      if (!interaction.isChatInputCommand()) return;

      const command = byName.get(interaction.commandName);
      if (!command) {
        await respondToChat(interaction, UNKNOWN_COMMAND_MESSAGE);
        return;
      }

      await command.execute(interaction);
    } catch (error) {
      logger.error('Interaction handling failed', error);
      if (interaction.isAutocomplete()) {
        await respondToAutocomplete(interaction, []);
        return;
      }
      if (interaction.isChatInputCommand()) {
        await respondToChat(interaction, interaction.deferred || interaction.replied
          ? GENERIC_RATE_MESSAGE
          : UNKNOWN_COMMAND_MESSAGE);
      }
    }
  };
}

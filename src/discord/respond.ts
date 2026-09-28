import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  InteractionReplyOptions,
} from 'discord.js';
import { logger } from '../utils/logger.js';

type ChatPayload = Pick<InteractionReplyOptions, 'content' | 'embeds' | 'components'>;

export async function respondToChat(
  interaction: ChatInputCommandInteraction,
  payload: string | ChatPayload,
): Promise<void> {
  const body: ChatPayload = typeof payload === 'string' ? { content: payload } : payload;

  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(body);
      return;
    }
    await interaction.reply(body);
  } catch (error) {
    logger.error('Failed to send a Discord response', error);
  }
}

export async function respondToAutocomplete(
  interaction: AutocompleteInteraction,
  choices: { name: string; value: string }[],
): Promise<void> {
  try {
    if (interaction.responded) return;
    await interaction.respond(choices.slice(0, 25));
  } catch (error) {
    logger.error('Failed to send autocomplete choices', error);
  }
}

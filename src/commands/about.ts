import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types/command.js';

const EMBED_COLOR = 0x2db350;

export const aboutCommandData = new SlashCommandBuilder()
  .setName('about')
  .setDescription('Learn what Yentopia is and where its rates come from.');

export function buildAboutEmbed(): EmbedBuilder {
  return new EmbedBuilder().setColor(EMBED_COLOR).setTitle('Yentopia').setDescription(
    [
      'A currency converter bot, used among internation pals across discord servers ✨',
      '',
      '**Exchange-rate data**',
      '[Frankfurter v2 API](https://frankfurter.dev/)',
      '',
      'Rates are reference exchange rates and may not represent the exact rate offered by banks, cards, exchanges, or payment providers.',
      '',
      'Yentopia is intended for informational and convenience use, not financial trading.',
    ].join('\n'),
  );
}

export function createAboutCommand(): Command {
  return {
    data: aboutCommandData,
    async execute(interaction) {
      await interaction.reply({ embeds: [buildAboutEmbed()] });
    },
  };
}

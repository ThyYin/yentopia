import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import type { Command } from '../types/command.js';

const EMBED_COLOR = 0x2db350;

export const helpCommandData = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Show Yentopia commands and examples.');

export function buildHelpEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setTitle('COMMANDS')
    .addFields(
      {
        name: '/convert',
        value: 'Convert an amount between currencies\n`/convert from:MYR to:USD amount:100`\n`cy!convert MYR USD 100`\n',
      },
      {
        name: '/rate',
        value: 'Check the exchange rate between two currencies\n`/rate from:SGD to:JPY`\n`cy!rate SGD JPY`',
      },
      {
        name: '/currency',
        value: 'View supported currencies, or search for one\n`/currency search:Philippines`\n`cy!currency Philippines`',
      },
      {
        name: '/about',
        value: 'Learn about Yentopia and its rate disclaimer\n`/about`\n`cy!about`',
      },
      {
        name: '/help',
        value: 'Shows this message, what else 🤦‍♂️\n`/help`\n`cy!help`',
      },
    )
    .setFooter({
      text: 'Rates come from Frankfurter and are daily reference rates, not live bank or card rates.',
    });
}

export function createHelpCommand(): Command {
  return {
    data: helpCommandData,
    async execute(interaction) {
      await interaction.reply({ embeds: [buildHelpEmbed()] });
    },
  };
}

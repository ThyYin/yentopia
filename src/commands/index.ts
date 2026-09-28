import type { CurrencyService } from '../services/currencyService.js';
import type { Command } from '../types/command.js';
import type { Cooldown } from '../utils/cooldown.js';
import { aboutCommandData, createAboutCommand } from './about.js';
import { createConvertCommand, convertCommandData } from './convert.js';
import { createCurrencyCommand, currencyCommandData } from './currency.js';
import { createHelpCommand, helpCommandData } from './help.js';
import { createRateCommand, rateCommandData } from './rate.js';

export interface CommandDeps {
  service: CurrencyService;
  cooldown: Cooldown;
}

export const commandBuilders = [
  convertCommandData,
  rateCommandData,
  currencyCommandData,
  aboutCommandData,
  helpCommandData,
];

export function createCommands(deps: CommandDeps): Command[] {
  return [
    createConvertCommand(deps.service, deps.cooldown),
    createRateCommand(deps.service, deps.cooldown),
    createCurrencyCommand(deps.service),
    createAboutCommand(),
    createHelpCommand(),
  ];
}

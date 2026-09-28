import { REST, Routes } from 'discord.js';
import 'dotenv/config';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { commandBuilders } from './commands/index.js';
import { loadDiscordConfig } from './config.js';
import { logger } from './utils/logger.js';

export function commandRegistrationBody() {
  return commandBuilders.map((command) => command.toJSON());
}

export async function deployCommands(): Promise<void> {
  const config = loadDiscordConfig();
  const body = commandRegistrationBody();
  const rest = new REST().setToken(config.token);

  await rest.put(Routes.applicationCommands(config.clientId), { body });
  logger.info(`Registered ${body.length} global commands`);
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

if (isDirectRun()) {
  deployCommands().catch((error: unknown) => {
    logger.error('Command registration failed', error);
    process.exit(1);
  });
}

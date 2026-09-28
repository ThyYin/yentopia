import { Client, Events, GatewayIntentBits } from 'discord.js';
import 'dotenv/config';
import { fileURLToPath } from 'node:url';
import { createCommands } from './commands/index.js';
import { loadDiscordConfig, USER_COOLDOWN_MS } from './config.js';
import { createInteractionHandler } from './discord/handler.js';
import { createPrefixHandler } from './prefix/handler.js';
import { FrankfurterProvider } from './services/frankfurterProvider.js';
import { CurrencyService } from './services/currencyService.js';
import { Cooldown } from './utils/cooldown.js';
import { shouldStartBot } from './utils/entrypoint.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  logger.info('Starting Yentopia');

  const discordConfig = loadDiscordConfig();
  const shutdownSignal = new AbortController();
  const provider = new FrankfurterProvider({ signal: shutdownSignal.signal });
  const service = new CurrencyService(provider);
  const cooldown = new Cooldown(USER_COOLDOWN_MS);
  const commands = createCommands({ service, cooldown });
  const handleInteraction = createInteractionHandler(commands, service);
  const handlePrefix = createPrefixHandler({ service, cooldown });

  await service.init();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once(Events.ClientReady, (readyClient) => {
    logger.info(`Yentopia logged in as ${readyClient.user.tag}`);
  });

  client.on(Events.InteractionCreate, (interaction) => {
    void handleInteraction(interaction);
  });

  client.on(Events.MessageCreate, (message) => {
    void handlePrefix(message);
  });

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`Received ${signal}. Shutting down.`);
    shutdownSignal.abort();
    service.dispose();
    client.destroy();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    shutdown('SIGTERM');
  });
  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled promise rejection', reason);
  });

  try {
    await client.login(discordConfig.token);
  } catch (error) {
    logger.error('Discord login failed', error);
    shutdownSignal.abort();
    service.dispose();
    process.exit(1);
  }
}

function isDirectRun(): boolean {
  return shouldStartBot(import.meta.url, process.argv[1], process.env.pm_exec_path);
}

if (isDirectRun()) {
  main().catch((error: unknown) => {
    logger.error('Yentopia failed to start', error);
    process.exit(1);
  });
} else {
  logger.warn(`Yentopia was loaded without starting. module=${fileURLToPath(import.meta.url)}`);
}

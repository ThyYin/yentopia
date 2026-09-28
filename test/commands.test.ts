import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  Interaction,
} from 'discord.js';
import { buildAboutEmbed, createAboutCommand } from '../src/commands/about.js';
import { commandBuilders, createCommands } from '../src/commands/index.js';
import { buildCurrencyPayload } from '../src/commands/currency.js';
import { buildConvertEmbed, createConvertCommand } from '../src/commands/convert.js';
import { buildHelpEmbed } from '../src/commands/help.js';
import { buildRateEmbed, createRateCommand } from '../src/commands/rate.js';
import { createInteractionHandler } from '../src/discord/handler.js';
import { CurrencyService } from '../src/services/currencyService.js';
import type { Currency, ExchangeRate, ExchangeRateProvider } from '../src/types/currency.js';
import { Cooldown } from '../src/utils/cooldown.js';
import { ProviderError } from '../src/utils/errors.js';
import {
  COOLDOWN_MESSAGE,
  CURRENCY_PAGE_OWNER_MESSAGE,
  GENERIC_RATE_MESSAGE,
  INVALID_AMOUNT_MESSAGE,
  TIMEOUT_MESSAGE,
  UNKNOWN_CURRENCY_MESSAGE,
} from '../src/utils/messages.js';

class FakeProvider implements ExchangeRateProvider {
  rateCalls = 0;
  error: ProviderError | null = null;

  async getCurrencies(): Promise<Currency[]> {
    return [
      { code: 'JPY', name: 'Japanese Yen' },
      { code: 'MYR', name: 'Malaysian Ringgit' },
      { code: 'SGD', name: 'Singapore Dollar' },
      { code: 'USD', name: 'US Dollar' },
    ];
  }

  async getRate(from: string, to: string): Promise<ExchangeRate> {
    this.rateCalls += 1;
    if (this.error) throw this.error;
    return { from, to, rate: from === 'JPY' ? 0.0088 : 0.2345, date: '2026-09-28' };
  }
}

class FakeChat {
  deferred = false;
  replied = false;
  calls: string[] = [];
  payloads: unknown[] = [];

  constructor(
    private readonly values: { from?: string | null; to?: string | null; amount?: number | null },
    readonly user = { id: '42' },
  ) {}

  options = {
    getString: (name: string): string | null => {
      if (name === 'from') return this.values.from ?? null;
      if (name === 'to') return this.values.to ?? null;
      return null;
    },
    getNumber: (name: string): number | null => {
      if (name === 'amount') return this.values.amount ?? null;
      return null;
    },
  };

  async deferReply(): Promise<void> {
    this.deferred = true;
    this.calls.push('defer');
  }

  async reply(payload: unknown): Promise<void> {
    this.replied = true;
    this.calls.push('reply');
    this.payloads.push(payload);
  }

  async editReply(payload: unknown): Promise<void> {
    this.calls.push('editReply');
    this.payloads.push(payload);
  }
}

function textOf(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  if (payload && typeof payload === 'object' && 'content' in payload) {
    const content = payload.content;
    return typeof content === 'string' ? content : '';
  }
  return '';
}

test('registers the five slash commands with autocomplete on currency options', () => {
  const body = commandBuilders.map((command) => command.toJSON());
  assert.deepEqual(
    body.map((command) => command.name),
    ['convert', 'rate', 'currency', 'about', 'help'],
  );

  const convert = body[0];
  assert.ok(convert);
  const names = convert.options?.map((option) => option.name);
  assert.deepEqual(names, ['from', 'to', 'amount']);
  const currencyCommand = body.find((command) => command.name === 'currency');
  assert.ok(currencyCommand);
  const search = currencyCommand.options?.find((option) => option.name === 'search');
  assert.ok(search);
  assert.notEqual(search.required, true);
  assert.equal(search.autocomplete, true);

  for (const option of convert.options ?? []) {
    if (option.name === 'from' || option.name === 'to') {
      assert.equal(option.autocomplete, true);
    }
  }
});

test('convert replies with a deferred embed and then uses the cache', async () => {
  const provider = new FakeProvider();
  const service = new CurrencyService(provider);
  await service.refreshCurrencies();
  let now = 0;
  const cooldown = new Cooldown(1_000, () => now);
  const command = createConvertCommand(service, cooldown);
  const interaction = new FakeChat({ from: 'myr', to: 'usd', amount: 100 });

  await command.execute(interaction as unknown as ChatInputCommandInteraction);

  assert.deepEqual(interaction.calls, ['defer', 'editReply']);
  const payload = interaction.payloads[0] as { embeds: { toJSON(): { description?: string; fields?: { name: string; value: string }[] } }[] };
  const embed = payload.embeds[0]?.toJSON();
  assert.match(embed?.description ?? '', /100\.00 MYR/);
  assert.match(embed?.description ?? '', /23\.45 USD/);
  assert.equal(embed?.fields?.some((field) => field.value.includes('28 September 2026')), true);
  assert.equal(provider.rateCalls, 1);

  now += 1_000;
  const again = new FakeChat({ from: 'MYR', to: 'USD', amount: 50 });
  await command.execute(again as unknown as ChatInputCommandInteraction);
  assert.equal(provider.rateCalls, 1);
});

test('convert reports an invalid amount without deferring or calling the API', async () => {
  const provider = new FakeProvider();
  const service = new CurrencyService(provider);
  await service.refreshCurrencies();
  const command = createConvertCommand(service, new Cooldown(1_000));
  const interaction = new FakeChat({ from: 'MYR', to: 'USD', amount: 0 });

  await command.execute(interaction as unknown as ChatInputCommandInteraction);

  assert.deepEqual(interaction.calls, ['reply']);
  assert.equal(textOf(interaction.payloads[0]), INVALID_AMOUNT_MESSAGE);
  assert.equal(provider.rateCalls, 0);
});

test('convert reports an unknown currency without calling the API', async () => {
  const provider = new FakeProvider();
  const service = new CurrencyService(provider);
  await service.refreshCurrencies();
  const command = createConvertCommand(service, new Cooldown(1_000));
  const interaction = new FakeChat({ from: 'XYZ', to: 'USD', amount: 10 });

  await command.execute(interaction as unknown as ChatInputCommandInteraction);

  assert.equal(textOf(interaction.payloads[0]), UNKNOWN_CURRENCY_MESSAGE);
  assert.equal(provider.rateCalls, 0);
});

test('an API timeout after defer edits the reply instead of sending a new one', async () => {
  const provider = new FakeProvider();
  provider.error = new ProviderError('TIMEOUT');
  const service = new CurrencyService(provider);
  await service.refreshCurrencies();
  const command = createConvertCommand(service, new Cooldown(1_000, () => 5));
  const interaction = new FakeChat({ from: 'MYR', to: 'USD', amount: 10 });

  await command.execute(interaction as unknown as ChatInputCommandInteraction);

  assert.deepEqual(interaction.calls, ['defer', 'editReply']);
  assert.equal(textOf(interaction.payloads[0]), TIMEOUT_MESSAGE);
});

test('a provider failure becomes a friendly message with no stack trace', async () => {
  const provider = new FakeProvider();
  provider.error = new ProviderError('UNAVAILABLE');
  const service = new CurrencyService(provider);
  await service.refreshCurrencies();
  const command = createRateCommand(service, new Cooldown(1_000, () => 9));
  const interaction = new FakeChat({ from: 'SGD', to: 'JPY' });

  await command.execute(interaction as unknown as ChatInputCommandInteraction);

  const message = textOf(interaction.payloads[0]);
  assert.equal(message, GENERIC_RATE_MESSAGE);
  assert.equal(message.includes('Error:'), false);
  assert.equal(message.includes('src\\'), false);
});

test('cooldown stops a second conversion before another API call', async () => {
  let now = 100;
  const provider = new FakeProvider();
  const service = new CurrencyService(provider);
  await service.refreshCurrencies();
  const cooldown = new Cooldown(1_000, () => now);
  const commands = createCommands({ service, cooldown });
  const convert = commands[0];
  const rate = commands[1];
  assert.ok(convert && rate);

  await convert.execute(
    new FakeChat({ from: 'MYR', to: 'USD', amount: 5 }) as unknown as ChatInputCommandInteraction,
  );
  const blocked = new FakeChat({ from: 'USD', to: 'JPY' });
  await rate.execute(blocked as unknown as ChatInputCommandInteraction);

  assert.equal(textOf(blocked.payloads[0]), COOLDOWN_MESSAGE);
  assert.deepEqual(blocked.calls, ['reply']);
  assert.equal(provider.rateCalls, 1);

  now += 1_000;
  const allowed = new FakeChat({ from: 'USD', to: 'JPY' });
  await rate.execute(allowed as unknown as ChatInputCommandInteraction);
  assert.equal(provider.rateCalls, 2);
});

test('autocomplete returns cached currency matches and never needs a fresh keystroke request', async () => {
  const provider = new FakeProvider();
  const service = new CurrencyService(provider);
  await service.refreshCurrencies();
  const callsBefore = provider.rateCalls;
  const command = createConvertCommand(service, new Cooldown(1_000));
  let choices: { name: string; value: string }[] = [];
  const interaction = {
    responded: false,
    options: {
      getFocused: () => ({ name: 'from', value: 'ring' }),
    },
    respond: async (next: { name: string; value: string }[]) => {
      choices = next;
    },
  };

  await command.autocomplete?.(interaction as unknown as AutocompleteInteraction);

  assert.deepEqual(choices, [{ name: 'MYR — Malaysian Ringgit', value: 'MYR' }]);
  assert.equal(provider.rateCalls, callsBefore);
});

test('help and about mention the reference-rate limitation', () => {
  const about = buildAboutEmbed().toJSON().description ?? '';
  const help = buildHelpEmbed().toJSON();
  assert.match(about, /Frankfurter/);
  assert.match(about, /not financial trading/i);
  assert.equal(help.fields?.some((field) => field.name === '/convert'), true);
  assert.match(JSON.stringify(help.fields), /cy!convert MYR USD 100/);
  assert.match(help.footer?.text ?? '', /reference rates/i);
});

test('same-currency conversion stays local in the embed', () => {
  const embed = buildConvertEmbed({
    from: 'MYR',
    to: 'MYR',
    amount: 100,
    converted: 100,
    rate: 1,
    date: null,
    sameCurrency: true,
  }).toJSON();

  assert.match(embed.description ?? '', /100\.00 MYR/);
  assert.equal(embed.fields?.some((field) => field.name === 'Rate date'), false);
  assert.match(embed.fields?.[0]?.value ?? '', /1 MYR = 1 MYR/);
});

test('rate embed shows the date and source', () => {
  const embed = buildRateEmbed({
    from: 'MYR',
    to: 'USD',
    rate: 0.2345,
    date: '2026-09-28',
  }).toJSON();

  assert.match(embed.description ?? '', /1 MYR = 0\.2345 USD/);
  assert.equal(embed.fields?.some((field) => field.value === 'Frankfurter'), true);
});

test('currency pages stay small and only the opener can change pages', async () => {
  const currencies = Array.from({ length: 25 }, (_, index) => ({
    code: `C${String(index).padStart(2, '0')}`,
    name: `Currency ${index}`,
  }));
  const first = buildCurrencyPayload(currencies, 0, '42');
  const description = first.embeds[0]?.toJSON().description ?? '';
  assert.match(description, /C00 — Currency 0/);
  assert.equal(description.includes('C20'), false);
  assert.equal(first.components.length, 1);

  const provider = new FakeProvider();
  provider.getCurrencies = async () => currencies;
  const service = new CurrencyService(provider);
  await service.refreshCurrencies();
  const handler = createInteractionHandler(createCommands({ service, cooldown: new Cooldown(1_000) }), service);

  let updated: unknown;
  let denied = '';
  await handler({
    isAutocomplete: () => false,
    isButton: () => true,
    isChatInputCommand: () => false,
    customId: 'yc:42:1',
    user: { id: '7' },
    reply: async (payload: { content?: string }) => {
      denied = payload.content ?? '';
    },
    update: async () => {},
  } as unknown as Interaction);
  assert.equal(denied, CURRENCY_PAGE_OWNER_MESSAGE);

  await handler({
    isAutocomplete: () => false,
    isButton: () => true,
    isChatInputCommand: () => false,
    customId: 'yc:42:1',
    user: { id: '42' },
    reply: async () => {},
    update: async (payload: unknown) => {
      updated = payload;
    },
  } as unknown as ButtonInteraction);

  const page = updated as { embeds: { toJSON(): { description?: string } }[] };
  assert.match(page.embeds[0]?.toJSON().description ?? '', /C20 — Currency 20/);
});

test('about command replies directly', async () => {
  const command = createAboutCommand();
  const interaction = new FakeChat({});
  await command.execute(interaction as unknown as ChatInputCommandInteraction);
  assert.deepEqual(interaction.calls, ['reply']);
});

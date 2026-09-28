import assert from 'node:assert/strict';
import test from 'node:test';
import type { Message } from 'discord.js';
import { createPrefixHandler } from '../src/prefix/handler.js';
import { parsePrefixCommand } from '../src/prefix/parse.js';
import { CurrencyService } from '../src/services/currencyService.js';
import type { Currency, ExchangeRate, ExchangeRateProvider } from '../src/types/currency.js';
import { Cooldown } from '../src/utils/cooldown.js';
import {
  COOLDOWN_MESSAGE,
  CONVERT_USAGE_MESSAGE,
  UNKNOWN_COMMAND_MESSAGE,
  UNKNOWN_CURRENCY_MESSAGE,
} from '../src/utils/messages.js';

class FakeProvider implements ExchangeRateProvider {
  rateCalls = 0;

  async getCurrencies(): Promise<Currency[]> {
    return [
      { code: 'JPY', name: 'Japanese Yen' },
      { code: 'MYR', name: 'Malaysian Ringgit' },
      { code: 'USD', name: 'US Dollar' },
    ];
  }

  async getRate(from: string, to: string): Promise<ExchangeRate> {
    this.rateCalls += 1;
    return { from, to, rate: 0.2345, date: '2026-09-28' };
  }
}

class FakeMessage {
  replies: unknown[] = [];
  typingCalls = 0;

  constructor(
    readonly content: string,
    readonly author: { id: string; bot: boolean } = { id: '42', bot: false },
  ) {}

  channel = {
    isSendable: () => true,
    sendTyping: async () => {
      this.typingCalls += 1;
    },
  };

  async reply(payload: unknown): Promise<void> {
    this.replies.push(payload);
  }
}

function textOf(payload: unknown): string {
  if (payload && typeof payload === 'object' && 'content' in payload) {
    const content = payload.content;
    return typeof content === 'string' ? content : '';
  }
  return '';
}

test('parses the cy! prefix and ignores other messages', () => {
  assert.equal(parsePrefixCommand('hello'), null);
  assert.equal(parsePrefixCommand('see cy!convert MYR USD 100'), null);
  assert.deepEqual(parsePrefixCommand('cy!'), { name: 'help', args: [] });
  assert.deepEqual(parsePrefixCommand('  CY!Convert   myr   usd   100 '), {
    name: 'convert',
    args: ['myr', 'usd', '100'],
  });
  assert.deepEqual(parsePrefixCommand('cy! rate SGD JPY'), {
    name: 'rate',
    args: ['SGD', 'JPY'],
  });
});

test('cy!convert replies with the conversion and shares the slash-command cooldown', async () => {
  const provider = new FakeProvider();
  const service = new CurrencyService(provider);
  await service.refreshCurrencies();
  let now = 0;
  const handle = createPrefixHandler({ service, cooldown: new Cooldown(1_000, () => now) });

  const first = new FakeMessage('cy!convert myr usd 100');
  await handle(first as unknown as Message);
  const payload = first.replies[0] as { embeds: { toJSON(): { description?: string } }[] };
  assert.match(payload.embeds[0]?.toJSON().description ?? '', /100\.00 MYR/);
  assert.match(payload.embeds[0]?.toJSON().description ?? '', /23\.45 USD/);
  assert.equal(provider.rateCalls, 1);

  const blocked = new FakeMessage('cy!rate USD JPY');
  await handle(blocked as unknown as Message);
  assert.equal(textOf(blocked.replies[0]), COOLDOWN_MESSAGE);
  assert.equal(provider.rateCalls, 1);

  now += 1_000;
  const again = new FakeMessage('cy!convert MYR USD 50');
  await handle(again as unknown as Message);
  assert.equal(provider.rateCalls, 1);
});

test('prefix commands reject bad input before calling the API', async () => {
  const provider = new FakeProvider();
  const service = new CurrencyService(provider);
  await service.refreshCurrencies();
  const handle = createPrefixHandler({ service, cooldown: new Cooldown(1_000) });

  const missing = new FakeMessage('cy!convert MYR');
  await handle(missing as unknown as Message);
  assert.equal(textOf(missing.replies[0]), CONVERT_USAGE_MESSAGE);

  const unknown = new FakeMessage('cy!convert XYZ USD 10');
  await handle(unknown as unknown as Message);
  assert.equal(textOf(unknown.replies[0]), UNKNOWN_CURRENCY_MESSAGE);

  const other = new FakeMessage('cy!price MYR');
  await handle(other as unknown as Message);
  assert.equal(textOf(other.replies[0]), UNKNOWN_COMMAND_MESSAGE);

  const ignored = new FakeMessage('convert MYR USD 100');
  await handle(ignored as unknown as Message);
  assert.equal(ignored.replies.length, 0);

  const bot = new FakeMessage('cy!convert MYR USD 100', { id: '1', bot: true });
  await handle(bot as unknown as Message);
  assert.equal(bot.replies.length, 0);
  assert.equal(provider.rateCalls, 0);
});

test('cy!currency searches, rejects misses, and still opens a later page', async () => {
  const provider = new FakeProvider();
  const service = new CurrencyService(provider);
  await service.refreshCurrencies();
  const handle = createPrefixHandler({ service, cooldown: new Cooldown(1_000) });

  const help = new FakeMessage('cy!');
  await handle(help as unknown as Message);
  const helpPayload = help.replies[0] as { embeds: { toJSON(): { title?: string } }[] };
  assert.match(helpPayload.embeds[0]?.toJSON().title ?? '', /COMMANDS/);

  const search = new FakeMessage('cy!currency MY');
  await handle(search as unknown as Message);
  const searchPayload = search.replies[0] as { embeds: { toJSON(): { description?: string; title?: string } }[] };
  const searchEmbed = searchPayload.embeds[0]?.toJSON();
  assert.match(searchEmbed?.title ?? '', /SEARCH RESULTS/);
  assert.match(searchEmbed?.description ?? '', /MYR — Malaysian Ringgit/);
  assert.equal(searchEmbed?.description?.includes('USD'), false);

  const miss = new FakeMessage('cy!currency ZZZZ');
  await handle(miss as unknown as Message);
  assert.match(textOf(miss.replies[0]), /couldn't find a currency matching "ZZZZ"/);

  const list = new FakeMessage('cy!currency');
  await handle(list as unknown as Message);
  const listPayload = list.replies[0] as { embeds: { toJSON(): { description?: string } }[] };
  assert.match(listPayload.embeds[0]?.toJSON().description ?? '', /MYR — Malaysian Ringgit/);

  const laterPage = new FakeMessage('cy!currency 2');
  await handle(laterPage as unknown as Message);
  assert.equal(laterPage.replies.length, 1);
});

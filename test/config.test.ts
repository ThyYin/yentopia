import assert from 'node:assert/strict';
import test from 'node:test';
import { loadDiscordConfig } from '../src/config.js';

test('requires the Discord token and client id', () => {
  assert.throws(() => loadDiscordConfig({}), /DISCORD_TOKEN, DISCORD_CLIENT_ID/);
  assert.throws(
    () => loadDiscordConfig({ DISCORD_TOKEN: 'token-value', DISCORD_CLIENT_ID: '' }),
    /DISCORD_CLIENT_ID/,
  );
});

test('does not include secret values in the missing-config error', () => {
  const secret = 'super-secret-token-value';
  assert.throws(
    () => loadDiscordConfig({ DISCORD_TOKEN: secret, DISCORD_CLIENT_ID: '' }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message.includes(secret), false);
      return true;
    },
  );
});

test('ignores a leftover guild id in the environment', () => {
  const config = loadDiscordConfig({
    DISCORD_TOKEN: 'token',
    DISCORD_CLIENT_ID: 'client',
    DISCORD_GUILD_ID: '123',
  });
  assert.equal('guildId' in config, false);
});

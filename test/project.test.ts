import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('..', import.meta.url);

function read(relativePath: string): string {
  return readFileSync(new URL(relativePath, root), 'utf8');
}

test('gitignore keeps secrets, builds, and logs out of git', () => {
  const gitignore = read('.gitignore');
  for (const line of ['.env', '.env.*', '!.env.example', 'node_modules/', 'dist/', 'logs/']) {
    assert.equal(gitignore.includes(line), true, line);
  }
});

test('env example lists only the Discord settings and leaves them empty', () => {
  const example = read('.env.example');
  assert.match(example, /^DISCORD_TOKEN=$/m);
  assert.match(example, /^DISCORD_CLIENT_ID=$/m);
  assert.equal(example.includes('GUILD'), false);
  assert.equal(example.toLowerCase().includes('frankfurter'), false);
  assert.equal(example.includes('API_KEY'), false);
});

test('slash commands are registered globally for every server', () => {
  const deploy = read('src/deploy-commands.ts');
  const config = read('src/config.ts');
  const index = read('src/index.ts');
  assert.match(deploy, /applicationCommands/);
  assert.equal(deploy.includes('applicationGuildCommands'), false);
  assert.equal(config.includes('DISCORD_GUILD_ID'), false);
  assert.match(index, /MessageContent/);
  assert.match(config, /cy!/);
  assert.equal(index.includes('applicationCommands'), false);
  assert.equal(index.includes('deployCommands'), false);
});

test('source files do not contain a filled-in Discord token', () => {
  const files = [
    'src/index.ts',
    'src/config.ts',
    'src/deploy-commands.ts',
    'README.md',
    'ecosystem.config.cjs',
  ];
  for (const file of files) {
    const source = read(file);
    assert.equal(/[\w-]{20,}\.[\w-]{6}\.[\w-]{20,}/.test(source), false, file);
  }
});

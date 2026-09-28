import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { shouldStartBot } from '../src/utils/entrypoint.js';

test('starts when node launches the file directly', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'yentopia-'));
  const file = path.join(directory, 'index.js');
  writeFileSync(file, '');
  const moduleUrl = pathToFileURL(file).href;

  assert.equal(shouldStartBot(moduleUrl, file, undefined), true);
});

test('starts when PM2 records the script path separately from argv', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'yentopia-'));
  const file = path.join(directory, 'index.js');
  writeFileSync(file, '');
  const moduleUrl = pathToFileURL(file).href;
  const pm2Container = path.join(directory, 'ProcessContainerFork.js');

  assert.equal(shouldStartBot(moduleUrl, pm2Container, file), true);
});

test('does not start when another file imports the bot', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'yentopia-'));
  const file = path.join(directory, 'index.js');
  const other = path.join(directory, 'other.js');
  writeFileSync(file, '');
  writeFileSync(other, '');

  assert.equal(shouldStartBot(pathToFileURL(file).href, other, undefined), false);
});

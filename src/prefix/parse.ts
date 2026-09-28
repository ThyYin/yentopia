import { COMMAND_PREFIX } from '../config.js';

export interface PrefixCommand {
  name: string;
  args: string[];
}

export function parsePrefixCommand(content: string): PrefixCommand | null {
  const trimmed = content.trim();
  const prefix = COMMAND_PREFIX.toLowerCase();
  if (!trimmed.toLowerCase().startsWith(prefix)) return null;

  const rest = trimmed.slice(COMMAND_PREFIX.length).trim();
  if (!rest) return { name: 'help', args: [] };

  const [name, ...args] = rest.split(/\s+/);
  if (!name) return { name: 'help', args: [] };
  return { name: name.toLowerCase(), args };
}

export function readKeyedArgs(args: readonly string[]): {
  from?: string;
  to?: string;
  amount?: string;
  positional: string[];
} {
  let from: string | undefined;
  let to: string | undefined;
  let amount: string | undefined;
  const positional: string[] = [];

  for (const arg of args) {
    const match = /^(from|to|amount):(.+)$/i.exec(arg);
    const key = match?.[1]?.toLowerCase();
    const value = match?.[2];
    if (key === 'from' && value) from = value;
    else if (key === 'to' && value) to = value;
    else if (key === 'amount' && value) amount = value;
    else positional.push(arg);
  }

  return { from, to, amount, positional };
}

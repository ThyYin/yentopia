import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function shouldStartBot(
  moduleUrl: string,
  argvPath: string | undefined,
  pmExecPath: string | undefined,
): boolean {
  const modulePath = fileURLToPath(moduleUrl);
  const candidates = [argvPath, pmExecPath].filter((value): value is string => Boolean(value?.trim()));
  return candidates.some((candidate) => samePath(candidate, modulePath));
}

function samePath(left: string, right: string): boolean {
  try {
    return realpathSync(left) === realpathSync(right);
  } catch {
    return path.resolve(left) === path.resolve(right);
  }
}

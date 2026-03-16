import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const ENV_FILE_NAMES = ['.env', '.env.example'];

function stripMatchingQuotes(value: string): string {
  const trimmed = value.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim();

  if (!trimmed || trimmed.startsWith('#')) {
    return null;
  }

  const separatorIndex = trimmed.indexOf('=');

  if (separatorIndex <= 0) {
    return null;
  }

  const key = trimmed.slice(0, separatorIndex).trim();
  const value = stripMatchingQuotes(trimmed.slice(separatorIndex + 1));

  if (!key) {
    return null;
  }

  return [key, value];
}

export function loadLocalEnv(): string | undefined {
  const searchDirs = [...new Set([path.resolve(__dirname, '..'), process.cwd()])];

  for (const dir of searchDirs) {
    for (const fileName of ENV_FILE_NAMES) {
      const filePath = path.join(dir, fileName);

      if (!existsSync(filePath)) {
        continue;
      }

      const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);

      for (const line of lines) {
        const entry = parseEnvLine(line);

        if (!entry) {
          continue;
        }

        const [key, value] = entry;

        if (process.env[key] === undefined) {
          process.env[key] = value;
        }
      }

      return filePath;
    }
  }

  return undefined;
}

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

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

function readEnvValue(key: string): string | undefined {
  for (const fileName of ['.env', '.env.example']) {
    const filePath = path.resolve(__dirname, fileName);

    if (!existsSync(filePath)) {
      continue;
    }

    const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      const separatorIndex = trimmed.indexOf('=');

      if (separatorIndex <= 0) {
        continue;
      }

      if (trimmed.slice(0, separatorIndex).trim() === key) {
        return stripMatchingQuotes(trimmed.slice(separatorIndex + 1));
      }
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const port = Number(process.env.PORT ?? env.PORT ?? readEnvValue('PORT') ?? 5173);

  return {
    plugins: [react()],
    server: {
      port,
    },
  };
});

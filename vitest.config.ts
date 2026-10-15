import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  test: { maxWorkers: 2, server: { deps: { inline: ['next-intl'] } } },
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
});

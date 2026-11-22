import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// One origin for the browser: /svc/<service>/... is proxied to the matching backend service
// (production uses the same prefixes in nginx). See design-plan "API origins".
const SERVICE_PORTS = {
  identity: 8001,
  offers: 8002,
  applications: 8003,
  internships: 8004,
  notifications: 8005,
} as const;

const proxy = Object.fromEntries(
  Object.entries(SERVICE_PORTS).map(([name, port]) => [
    `/svc/${name}`,
    {
      target: `http://localhost:${port}`,
      changeOrigin: true,
      rewrite: (path: string) => path.replace(`/svc/${name}`, ''),
    },
  ]),
);

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 3000, strictPort: true, proxy },
  preview: { port: 3000, strictPort: true, proxy },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});

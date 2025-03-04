import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // Use 'node' environment since you're working in a Node.js context
  },
});

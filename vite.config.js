import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 8082 },
  assetsInclude: ['**/*.vert', '**/*.frag'],
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
});

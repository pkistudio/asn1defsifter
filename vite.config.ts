import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: {
        index: 'src/index.ts',
        core: 'src/core.ts',
        app: 'src/app.ts'
      },
      formats: ['es'],
      cssFileName: 'styles',
      fileName: (_format, entryName) => `${entryName}.js`
    },
    rollupOptions: {
      external: ['@pkistudio/asn1instancebuilder', '@pkistudio/pkistudiojs/core', '@pkistudio/pkistudiojs/oid-resolver', '@pkistudio/pkistudiojs/viewer']
    }
  }
});
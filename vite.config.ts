import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: {
        index: 'src/index.ts',
        core: 'src/core.ts'
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`
    },
    rollupOptions: {
      external: ['@pkistudio/asn1instancebuilder', '@pkistudio/pkistudiojs/core', '@pkistudio/pkistudiojs/oid-resolver']
    }
  }
});
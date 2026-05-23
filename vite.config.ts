import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const packageJson = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf8')) as { version: string };

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
  },
  define: {
    __ASN1_DEFINITION_SIFTER_VERSION__: JSON.stringify(packageJson.version)
  }
});

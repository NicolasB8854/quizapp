// Bundelt den lokalen Test-Server (src/dev/localServer.ts). Ersetzt die
// AWS-Module `../db`, `../broadcast` und `../insights` durch den In-Memory-
// Speicher aus src/dev/memory.ts — der Produktions-Build bleibt davon unberührt.
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import esbuild from 'esbuild'

const memory = fileURLToPath(new URL('./src/dev/memory.ts', import.meta.url))

rmSync('dist-local', { recursive: true, force: true })

await esbuild.build({
  entryPoints: ['src/dev/localServer.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'dist-local/server.cjs',
  logLevel: 'warning',
  plugins: [
    {
      name: 'in-memory-aws',
      setup(build) {
        build.onResolve({ filter: /^\.\.\/(db|broadcast|insights)$/ }, (args) =>
          args.importer.includes('/src/handlers/') ? { path: memory } : undefined,
        )
      },
    },
  ],
})

console.log('✓ local server at server/dist-local/server.cjs')

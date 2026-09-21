// Bundelt den Lambda-Handler zu einer einzigen CommonJS-Datei.
// AWS Lambda kann ESM ausführen, aber CJS spart uns die zusätzlichen
// `"type": "module"`- und package.json-Klimmzüge im Deploy-Artefakt.
//
// AWS-SDK v3 (`@aws-sdk/*`) ist in der nodejs20.x-Runtime bereits vorhanden
// und wird deshalb als `external` markiert, damit unser Bundle klein bleibt.

import { rmSync } from 'node:fs'
import esbuild from 'esbuild'

rmSync('dist', { recursive: true, force: true })

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'dist/index.js',
  minify: false,
  sourcemap: 'inline',
  logLevel: 'info',
  external: ['@aws-sdk/*'],
})

console.log('✓ Lambda bundle at server/dist/index.js')

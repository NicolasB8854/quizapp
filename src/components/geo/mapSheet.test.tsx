/**
 * Vorschau der Weltkarte (kein normaler Test). Nur mit GEO_SHEET=<ordner>:
 *   GEO_SHEET=.audit-work/geo npx vitest run src/components/geo/mapSheet.test.tsx
 */
import { describe, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { WorldMap } from './WorldMap'

const OUT = process.env.GEO_SHEET

describe.skipIf(!OUT)('Weltkarten-Vorschau', () => {
  it('schreibt HTML', () => {
    const world = 'file://' + resolve(__dirname, '../../../public/img/geo/world.svg')
    const answering = renderToStaticMarkup(
      <WorldMap pins={[{ id: 'a', lat: 48.2, lon: 16.4, color: '#7C5CFF', mine: true }]} onPick={() => {}} />,
    )
    const revealed = renderToStaticMarkup(
      <WorldMap
        aspect={2}
        pins={[
          { id: 'a', lat: 14.7, lon: -17.4, color: '#7C5CFF' },
          { id: 'b', lat: 12.4, lon: -1.5, color: '#27D8FF' },
        ]}
        target={{ lat: 16.766, lon: -3.003, name: 'Timbuktu' }}
        distances={{ a: '1.540 km', b: '488 km' }}
      />,
    )
    const html = `<html><body style="margin:0;background:#0B1020;display:flex;gap:16px;padding:10px;width:900px">
      <div style="width:420px;">${answering}</div>
      <div style="width:440px;">${revealed}</div>
    </body></html>`.replaceAll('href="/img/geo/world.svg"', `href="${world}"`)
    writeFileSync(join(OUT!, 'map-preview.html'), html)
  })
})

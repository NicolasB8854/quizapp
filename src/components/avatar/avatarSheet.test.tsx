/**
 * Kontaktbogen für die Avatar-Gestaltung (kein normaler Test).
 * Läuft nur mit AVATAR_SHEET=<ausgabeordner>, z. B.:
 *   AVATAR_SHEET=.audit-work/avatars npx vitest run src/components/avatar/avatarSheet.test.tsx
 * Danach: sips -s format png <datei>.svg --out <datei>.png
 */
import { describe, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  AVATAR_COLORS,
  AVATAR_PARTS,
  DEFAULT_AVATAR_LOOK,
  randomAvatarLook,
  type AvatarLook,
  type AvatarPartKey,
} from '@quizapp/shared'
import { AvatarFigure } from './AvatarFigure'

const OUT = process.env.AVATAR_SHEET

function sheet(cells: { look: AvatarLook; accent: string; crop?: 'face' | 'bust' }[], cols: number, size = 220): string {
  const rows = Math.ceil(cells.length / cols)
  const inner = cells
    .map(({ look, accent, crop }, i) => {
      // renderToStaticMarkup vergibt pro Aufruf dieselbe useId → pro Zelle eindeutig machen.
      const svg = renderToStaticMarkup(<AvatarFigure look={look} accentHex={accent} crop={crop} />).replaceAll('av-', `c${i}-av-`)
      const pad = Math.max(4, Math.round(size * 0.05))
      const x = (i % cols) * size + pad
      const y = Math.floor(i / cols) * size + pad
      const d = size - 2 * pad
      const r = d / 2
      // Rund maskieren wie im App-Badge (rounded-full), plus Kleinansicht 44 px daneben.
      const ring = `<path fill="#0B1020" fill-rule="evenodd" d="M${x} ${y}h${d}v${d}h${-d}Z M${x + r} ${y} a${r} ${r} 0 1 0 0.01 0Z"/>`
      return svg.replace('<svg ', `<svg x="${x}" y="${y}" width="${d}" height="${d}" `) + ring
    })
    .join('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * size}" height="${rows * size}" viewBox="0 0 ${cols * size} ${rows * size}"><rect width="100%" height="100%" fill="#0B1020"/>${inner}</svg>`
}

describe.skipIf(!OUT)('Avatar-Kontaktbogen', () => {
  it('schreibt Bögen', () => {
    mkdirSync(OUT!, { recursive: true })
    const random = Array.from({ length: 16 }, (_, i) => ({
      look: randomAvatarLook(1000 + i),
      accent: AVATAR_COLORS[i % AVATAR_COLORS.length],
    }))
    writeFileSync(join(OUT!, 'sheet-random.svg'), sheet(random, 4))
    // Echte Badge-Größen: 48 px (Gesicht) und 96 px (Brustbild).
    writeFileSync(join(OUT!, 'sheet-small.svg'), sheet([...random.map((c) => ({ ...c, crop: 'face' as const }))], 8, 48))
    writeFileSync(join(OUT!, 'sheet-medium.svg'), sheet(random, 8, 96))

    // Passform: jede Frisur bzw. jeder Bart auf jeder Kopfform (Zeilen = Köpfe).
    for (const key of ['hair', 'beard'] as const) {
      const cells = AVATAR_PARTS.head.flatMap((head, r) =>
        (AVATAR_PARTS[key] as readonly string[]).map((id, i) => ({
          look: { ...DEFAULT_AVATAR_LOOK, head, skin: (i + r) % 8, hairColor: (i + 2 * r) % 6, [key]: id, ...(key === 'beard' ? { hair: 'short' } : {}) } as AvatarLook,
          accent: AVATAR_COLORS[(i + r) % AVATAR_COLORS.length],
        })),
      )
      writeFileSync(join(OUT!, `sheet-fit-${key}.svg`), sheet(cells, AVATAR_PARTS[key].length, 150))
    }

    const keys: AvatarPartKey[] = ['hair', 'eyes', 'mouth', 'beard', 'glasses', 'accessory', 'outfit', 'head', 'brows', 'nose']
    for (const key of keys) {
      const cells = (AVATAR_PARTS[key] as readonly string[]).map((id, i) => ({
        look: { ...DEFAULT_AVATAR_LOOK, skin: i % 8, hairColor: key === 'hair' ? i % 8 : 1, [key]: id } as AvatarLook,
        accent: AVATAR_COLORS[i % AVATAR_COLORS.length],
      }))
      writeFileSync(join(OUT!, `sheet-${key}.svg`), sheet(cells, Math.min(5, cells.length)))
    }
  })
})

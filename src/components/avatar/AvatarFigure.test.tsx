import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AVATAR_PARTS, DEFAULT_AVATAR_LOOK, randomAvatarLook, type AvatarLook, type AvatarPartKey } from '@quizapp/shared'
import { AvatarFigure } from './AvatarFigure'
import { AvatarBadge } from '../AvatarBadge'

describe('AvatarFigure', () => {
  it('rendert jedes Bauteil ohne Fehler', () => {
    for (const key of Object.keys(AVATAR_PARTS) as AvatarPartKey[]) {
      for (const id of AVATAR_PARTS[key]) {
        const html = renderToStaticMarkup(<AvatarFigure look={{ ...DEFAULT_AVATAR_LOOK, [key]: id } as AvatarLook} />)
        expect(html.startsWith('<svg')).toBe(true)
        expect(html).not.toContain('NaN')
      }
    }
  })

  it('bleibt klein genug für viele Avatare pro Bildschirm', () => {
    const html = renderToStaticMarkup(<AvatarFigure look={randomAvatarLook(7)} />)
    expect(html.length).toBeLessThan(12_000)
  })

  it('Crop face zoomt auf den Kopf', () => {
    expect(renderToStaticMarkup(<AvatarFigure look={DEFAULT_AVATAR_LOOK} crop="face" />)).toContain('viewBox="31 20 138 138"')
  })
})

describe('AvatarBadge mit Figur', () => {
  it('Foto > Figur > Emoji', () => {
    const look = randomAvatarLook(5)
    const fig = renderToStaticMarkup(<AvatarBadge avatar={{ colorHex: '#7C5CFF', photoDataUrl: null, emoji: '🦊', look }} name="Ana" />)
    expect(fig).toContain('<svg')
    expect(fig).not.toContain('🦊')
    const photo = renderToStaticMarkup(
      <AvatarBadge avatar={{ colorHex: '#7C5CFF', photoDataUrl: 'data:image/png;base64,AA', look }} name="Ana" />,
    )
    expect(photo).toContain('<img')
    const emoji = renderToStaticMarkup(<AvatarBadge avatar={{ colorHex: '#7C5CFF', photoDataUrl: null, emoji: '🦊', look: null }} />)
    expect(emoji).toContain('🦊')
  })
})

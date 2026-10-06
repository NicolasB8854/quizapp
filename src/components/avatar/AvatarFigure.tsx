/**
 * AvatarFigure — zeichnet eine Figur aus dem Avatar-Baukasten als SVG.
 *
 * Bühne 200×200, Brustbild. Ebenen (hinten → vorne):
 *   Glow-Hintergrund → Haare hinten → Hals → Outfit → lange Strähnen → Ohren →
 *   Kopf (+ Schattierung, Neon-Streiflicht) → Wangen → Bart → Nase → Mund →
 *   Schnurrbart → Augen → Brauen → Haare vorne → Brille → Accessoire.
 *
 * Look: flach, freundlich, mit dem QUIZO-Show-Licht — Hintergrund-Glow in der
 * Spielerfarbe, farbige Kante rechts am Gesicht und an den Schultern.
 * `crop="face"` zoomt auf den Kopf (für kleine Badges), `"bust"` zeigt alles.
 */

import { useId, type ReactNode } from 'react'
import { buildHair } from './hair'
import {
  EYE_COLORS,
  HAIR_COLORS,
  OUTFIT_COLORS,
  SKIN_TONES,
  type AvatarLook,
} from '@quizapp/shared'

export type AvatarCrop = 'face' | 'bust'

interface Props {
  look: AvatarLook
  /** Spielerfarbe: Hintergrund-Glow + Neon-Kanten. */
  accentHex?: string
  crop?: AvatarCrop
  className?: string
  title?: string
}

// ---------------------------------------------------------------------------
// Farb-Helfer

function mix(hex: string, target: string, amount: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [a, b] = [p(hex), p(target)]
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * amount).toString(16).padStart(2, '0')).join('')
}
const shade = (hex: string, amt: number) => mix(hex, '#000000', amt)
function luma(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
/** Haar-/Bartfarbe, die sich sichtbar von der Haut abhebt (ΔL ≥ ~0.16). */
function against(color: string, skin: string): string {
  const d = luma(color) - luma(skin)
  if (Math.abs(d) >= 0.16) return color
  return luma(skin) > 0.3 ? shade(color, 0.5) : mix(color, '#ffffff', 0.22)
}
const tint = (hex: string, amt: number) => mix(hex, '#ffffff', amt)

const INK = '#1A1420'
const LIP = '#4A1E2B'
const MOUTH = '#3B1626'

// ---------------------------------------------------------------------------
// Geometrie

interface Head {
  d: string
  earX: number
  /** Skalierung der Haar-/Hut-Ebenen relativ zum Oval (um 100/93), damit sie auf dem Schädel sitzen. */
  sx: number
  sy: number
}

const HEADS: Record<AvatarLook['head'], Head> = {
  oval: { d: 'M62 90 C62 60 79 46 100 46 C121 46 138 60 138 90 C138 120 122 140 100 140 C78 140 62 120 62 90 Z', earX: 63, sx: 1, sy: 1 },
  round: { d: 'M59 92 C59 63 77 48 100 48 C123 48 141 63 141 92 C141 120 124 137 100 137 C76 137 59 120 59 92 Z', earX: 60, sx: 1.1, sy: 0.96 },
  square: { d: 'M62 84 C62 58 79 46 100 46 C121 46 138 58 138 84 L138 110 C138 128 122 140 100 140 C78 140 62 128 62 110 Z', earX: 63, sx: 1.01, sy: 1 },
  long: { d: 'M65 88 C65 57 81 43 100 43 C119 43 135 57 135 88 C135 122 120 143 100 143 C80 143 65 122 65 88 Z', earX: 66, sx: 0.9, sy: 1.06 },
}

/** Mit Cap/Mütze ist nur das Haar unterhalb der Hutkante sichtbar. */
const HAT = new Set<AvatarLook['accessory']>(['cap', 'beanie'])

const EYE_Y = 96
const EYE_X = 85 // linkes Auge; rechtes = gespiegelt
const MIRROR = 'matrix(-1 0 0 1 200 0)'

const SHOULDERS = 'M18 200 C20 170 46 152 80 148 L120 148 C154 152 180 170 182 200 Z'
const SHOULDER_EDGE = 'M18 200 C20 170 46 152 80 148 L120 148 C154 152 180 170 182 200'

/** Beidseitig: links zeichnen, rechts spiegeln. */
function Both({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <g transform={MIRROR}>{children}</g>
    </>
  )
}

// ---------------------------------------------------------------------------
// Haare

// ---------------------------------------------------------------------------
// Gesicht

function Eye({ kind, iris, lid }: { kind: AvatarLook['eyes']; iris: string; lid: string }) {
  const x = EYE_X
  const y = EYE_Y
  const open = (rx: number, ry: number, ir: number) => (
    <>
      <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#FFFFFF" />
      <circle cx={x + 0.5} cy={y + 0.5} r={ir} fill={iris} />
      <circle cx={x + 0.5} cy={y + 0.5} r={ir * 0.5} fill={INK} />
      <circle cx={x + 2} cy={y - 1.6} r={1.3} fill="#FFFFFF" />
    </>
  )
  switch (kind) {
    case 'round':
    case 'wink':
      return open(7, 7.6, 4.6)
    case 'wide':
      return open(8, 9, 5.2)
    case 'dots':
      return (
        <>
          <ellipse cx={x} cy={y} rx={4.4} ry={5.2} fill={INK} />
          <circle cx={x + 1.5} cy={y - 1.8} r={1.4} fill="#FFFFFF" />
        </>
      )
    case 'happy':
      return <path d={`M${x - 7} ${y + 2} Q${x} ${y - 6.5} ${x + 7} ${y + 2}`} stroke={INK} strokeWidth={3.2} fill="none" strokeLinecap="round" />
    case 'sleepy':
      return (
        <>
          {open(7, 7.6, 4.6)}
          <path d={`M${x - 7} ${y - 1.8} A7 7.4 0 0 1 ${x + 7} ${y - 1.8} Z`} fill={lid} />
          <path d={`M${x - 7} ${y - 1.8} Q${x} ${y - 0.6} ${x + 7} ${y - 1.8}`} stroke={INK} strokeWidth={2} fill="none" strokeLinecap="round" />
        </>
      )
  }
}

function Brow({ kind, color }: { kind: AvatarLook['brows']; color: string }) {
  const common = { stroke: color, fill: 'none', strokeLinecap: 'round' as const }
  switch (kind) {
    case 'natural':
      return <path d="M77 85 Q85 79 93 83" strokeWidth={4.2} {...common} />
    case 'thick':
      return <path d="M76 85 Q85 78 94 83" strokeWidth={5.6} {...common} />
    case 'raised':
      return <path d="M77 81 Q85 73 93 79" strokeWidth={4} {...common} />
    case 'angry':
      return <path d="M77 80 L93 86" strokeWidth={3.8} {...common} />
    case 'worried':
      return <path d="M77 85 Q85 83 93 78" strokeWidth={4} {...common} />
  }
}

function Nose({ kind, skin }: { kind: AvatarLook['nose']; skin: string }) {
  const dark = shade(skin, 0.28)
  switch (kind) {
    case 'soft':
      return <path d="M99 100 Q95 110 99 113 Q102 114 105 111" stroke={dark} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    case 'button':
      return (
        <>
          <ellipse cx={100} cy={110} rx={5.2} ry={3.8} fill={shade(skin, 0.14)} />
          <ellipse cx={98.6} cy={108.8} rx={1.8} ry={1.1} fill="#ffffff" opacity={0.35} />
        </>
      )
    case 'pointy':
      return <path d="M101 98 L94.5 111.5 Q99 115 104 112" stroke={dark} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
  }
}

function Mouth({ kind, lip = LIP }: { kind: AvatarLook['mouth']; lip?: string }) {
  const line = { stroke: lip, strokeWidth: 3.6, fill: 'none', strokeLinecap: 'round' as const }
  switch (kind) {
    case 'smile':
      return <path d="M87 119 Q100 132 113 119" {...line} />
    case 'grin':
      return (
        <>
          <path d="M88 119 Q100 134 112 119 Z" fill={MOUTH} />
          <path d="M90.5 119.6 L109.5 119.6 Q108.5 123.4 100 124 Q91.5 123.4 90.5 119.6 Z" fill="#FFFFFF" />
        </>
      )
    case 'laugh':
      return (
        <>
          <path d="M87 117 Q100 140 113 117 Z" fill={MOUTH} />
          <path d="M89.5 117.6 L110.5 117.6 L109.4 120.4 L90.6 120.4 Z" fill="#FFFFFF" />
          <ellipse cx={100} cy={124.6} rx={6.4} ry={3.4} fill="#FF7A8A" />
        </>
      )
    case 'smirk':
      return <path d="M88 122 Q102 128 113 117" {...line} />
    case 'neutral':
      return <path d="M90 123 Q100 125 110 123" {...line} />
    case 'oh':
      return <ellipse cx={100} cy={124} rx={4.6} ry={5.6} fill={MOUTH} />
  }
}

const MUSTACHE = 'M88 116 C91 110 97 111 100 113.5 C103 111 109 110 112 116 C107 115 104 116 100 116.5 C96 116 93 115 88 116 Z'

// ---------------------------------------------------------------------------
// Outfit

function Outfit({ kind, c, accent, skin }: { kind: AvatarLook['outfit']; c: string; accent: string; skin: string }) {
  const cs = shade(c, 0.22)
  const light = c.toLowerCase() === '#e8ecf8'
  const detail = light ? '#9AA4BD' : tint(c, 0.35)
  const base = <path d={SHOULDERS} fill={c} stroke={shade(c, 0.45)} strokeWidth={1.6} />
  switch (kind) {
    case 'hoodie':
      return (
        <>
          {base}
          <path d="M72 150 C80 166 120 166 128 150" stroke={cs} strokeWidth={10} fill="none" strokeLinecap="round" />
          <path d="M93 162 L92 182 M107 162 L108 182" stroke={detail} strokeWidth={2.2} strokeLinecap="round" />
        </>
      )
    case 'tee':
      return (
        <>
          {base}
          <path d="M82 149 Q100 166 118 149" stroke={cs} strokeWidth={4} fill="none" strokeLinecap="round" />
        </>
      )
    case 'blazer':
      return (
        <>
          {base}
          <path d="M84 148 L100 188 L116 148 Z" fill="#F2F4FA" />
          <path d="M96 152 L100 160 L104 152 Z M98 160 L96 178 L100 184 L104 178 L102 160 Z" fill={accent} />
          <Both>
            <path d="M80 148 L99 190 L86 176 L72 156 Z" fill={cs} />
          </Both>
        </>
      )
    case 'turtleneck':
      return (
        <>
          {base}
          <path d="M80 136 L120 136 L124 158 Q100 167 76 158 Z" fill={cs} />
          {[142, 149].map((y) => (
            <path key={y} d={`M80.5 ${y} L119.5 ${y}`} stroke={shade(c, 0.35)} strokeWidth={1.4} opacity={0.6} />
          ))}
        </>
      )
    case 'jersey':
      return (
        <>
          {base}
          <path d="M83 149 L100 170 L117 149" stroke={light ? '#232C4A' : '#FFFFFF'} strokeWidth={4.5} fill="none" strokeLinejoin="round" />
          <Both>
            <path d="M28 182 C38 166 54 158 70 154" stroke={accent} strokeWidth={6} fill="none" strokeLinecap="round" />
          </Both>
          <text x={100} y={192} textAnchor="middle" fontSize={16} fontWeight={900} fontFamily="Montserrat, Arial, sans-serif" fill={light ? '#232C4A' : '#FFFFFF'} opacity={0.9}>
            Q
          </text>
        </>
      )
  }
  // Fallback (nie erreicht), damit TS zufrieden ist.
  return <path d={SHOULDERS} fill={skin} />
}

// ---------------------------------------------------------------------------
// Brille & Accessoires

function Glasses({ kind, accent, ids, earX }: { kind: AvatarLook['glasses']; accent: string; ids: { shades: string; visor: string }; earX: number }) {
  const frame = '#1A1D2E'
  const t = earX + 3 // Bügel endet am Ohr
  switch (kind) {
    case 'none':
      return null
    case 'round':
      return (
        <>
          <Both>
            <circle cx={EYE_X} cy={EYE_Y} r={10} fill="#ffffff" fillOpacity={0.08} stroke={frame} strokeWidth={2.2} />
            <path d={`M74.5 94 L${t} 92`} stroke={frame} strokeWidth={2.4} strokeLinecap="round" />
          </Both>
          <path d="M95.5 95 Q100 91.5 104.5 95" stroke={frame} strokeWidth={2.4} fill="none" />
        </>
      )
    case 'square':
      return (
        <>
          <Both>
            <rect x={EYE_X - 10.5} y={EYE_Y - 8} width={21} height={16} rx={4} fill="#ffffff" fillOpacity={0.08} stroke={frame} strokeWidth={2.3} />
            <path d={`M73.5 93 L${t} 92`} stroke={frame} strokeWidth={2.4} strokeLinecap="round" />
          </Both>
          <path d="M96.5 94 Q100 92 103.5 94" stroke={frame} strokeWidth={2.6} fill="none" />
        </>
      )
    case 'shades':
      return (
        <>
          <Both>
            <path d={`M${EYE_X - 10.5} ${EYE_Y - 7} L${EYE_X + 10} ${EYE_Y - 7} Q${EYE_X + 10} ${EYE_Y + 8} ${EYE_X - 0.5} ${EYE_Y + 8} Q${EYE_X - 10.5} ${EYE_Y + 8} ${EYE_X - 10.5} ${EYE_Y - 7} Z`} fill="#141826" stroke="#0D0F1A" strokeWidth={2} />
            <path d={`M${EYE_X - 7} ${EYE_Y + 4} L${EYE_X + 2} ${EYE_Y - 5}`} stroke={`url(#${ids.shades})`} strokeWidth={2.4} strokeLinecap="round" />
            <path d={`M73 90 L${t} 90`} stroke="#0D0F1A" strokeWidth={2.4} strokeLinecap="round" />
          </Both>
          <path d="M95 90 L105 90" stroke="#0D0F1A" strokeWidth={2.6} />
        </>
      )
    case 'visor':
      return (
        <>
          <path d="M67 87 L133 87 Q137 96 133 105 L67 105 Q63 96 67 87 Z" fill={`url(#${ids.visor})`} />
          <Both>
            <rect x={EYE_X - 6} y={EYE_Y - 1.6} width={12} height={3.2} rx={1.6} fill="#ffffff" opacity={0.9} />
          </Both>
          <Both>
            <path d={`M66 94 L${t} 93`} stroke="#1A1D2E" strokeWidth={3} strokeLinecap="round" />
          </Both>
          <path d="M68 91 L120 91" stroke="#ffffff" strokeWidth={1.6} opacity={0.55} strokeLinecap="round" />
          <path d="M67 87 L133 87 Q137 96 133 105 L67 105 Q63 96 67 87 Z" fill="none" stroke={tint(accent, 0.3)} strokeWidth={1.2} />
        </>
      )
  }
}

function Accessory({ kind, earX, outfit, accent }: { kind: AvatarLook['accessory']; earX: number; outfit: string; accent: string }) {
  const os = shade(outfit, 0.25)
  switch (kind) {
    case 'none':
      return null
    case 'headphones':
      return (
        <>
          <path d="M57 98 C52 36 148 36 143 98" stroke="#1E2238" strokeWidth={9} fill="none" strokeLinecap="round" />
          <path d="M59 84 C58 46 142 46 141 84" stroke={tint(accent, 0.3)} strokeWidth={2} fill="none" opacity={0.85} />
          <Both>
            <rect x={earX - 12} y={85} width={15} height={23} rx={7} fill="#1E2238" />
            <rect x={earX - 9.5} y={88} width={8} height={17} rx={4} fill={accent} />
          </Both>
        </>
      )
    case 'cap':
      return (
        <>
          <path d="M56 80 C56 48 78 38 100 38 C122 38 144 48 144 80 Z" fill={outfit} />
          <path d="M55 79 Q100 69 145 79 Q147 86 141 88 Q100 80 59 88 Q53 86 55 79 Z" fill={os} />
          <path d="M100 39 L100 76" stroke={os} strokeWidth={1.4} opacity={0.6} />
          <circle cx={100} cy={39} r={3.2} fill={os} />
        </>
      )
    case 'beanie':
      return (
        <>
          <path d="M57 80 C55 48 78 36 100 36 C122 36 145 48 143 80 Z" fill={outfit} />
          <path d="M57 69 Q100 65 143 69 Q146 76 144 82 Q100 87 56 82 Q54 76 57 69 Z" fill={os} />
          {[66, 78, 90, 102, 114, 126, 136].map((x) => (
            <path key={x} d={`M${x} 70 L${x} 81`} stroke={shade(outfit, 0.4)} strokeWidth={1.4} opacity={0.5} />
          ))}
          <circle cx={100} cy={34} r={8} fill={tint(outfit, 0.35)} />
        </>
      )
    case 'earrings':
      return (
        <Both>
          <circle cx={earX + 1} cy={112} r={4.6} fill="none" stroke="#F0C04A" strokeWidth={2.8} />
          <circle cx={earX + 1} cy={107.6} r={2.2} fill="#F0C04A" />
        </Both>
      )
    case 'partyhat':
      return (
        <g transform="rotate(10 100 50) translate(100 50) scale(0.72) translate(-100 -56)">
          <path d="M100 16 L120 56 Q100 63 80 56 Z" fill={accent} />
          <path d="M80 56 Q100 63 120 56" stroke={shade(accent, 0.3)} strokeWidth={2.5} fill="none" />
          <path d="M91 36 L109 36 M86 46 L114 46" stroke="#FFFFFF" strokeWidth={2.6} opacity={0.65} />
          <circle cx={100} cy={17} r={5} fill="#FFE066" />
        </g>
      )
  }
}

// ---------------------------------------------------------------------------

export function AvatarFigure({ look, accentHex = '#7C5CFF', crop = 'bust', className, title }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const ids = {
    bg: `av-bg-${uid}`,
    clip: `av-clip-${uid}`,
    head: `av-head-${uid}`,
    shades: `av-sh-${uid}`,
    visor: `av-vi-${uid}`,
    below: `av-bl-${uid}`,
    beard: `av-bd-${uid}`,
    stubble: `av-st-${uid}`,
  }
  const skin = SKIN_TONES[look.skin] ?? SKIN_TONES[2]
  const skinShade = shade(skin, 0.14)
  // Konturen: halten Haar/Haut auch klein und bei ähnlichen Tönen auseinander.
  const skinLine = shade(skin, 0.38)
  const hair = against(HAIR_COLORS[look.hairColor] ?? HAIR_COLORS[2], SKIN_TONES[look.skin] ?? SKIN_TONES[2])
  const skinTone = SKIN_TONES[look.skin] ?? SKIN_TONES[2]
  // Bart klar von der Haut absetzen; bei sehr dunkler Haut zusätzlich helle Kontur.
  // Helles Haar bleibt im Bart erkennbar hell (nur moderat abgedunkelt), nie „oliv-schwarz".
  const beardBase = shade(hair, 0.12)
  const beardColor =
    Math.abs(luma(beardBase) - luma(skinTone)) >= 0.12
      ? beardBase
      : luma(skinTone) > 0.3
        ? shade(hair, luma(hair) > 0.5 ? 0.3 : 0.5)
        : mix(beardBase, '#ffffff', 0.22)
  const darkSkin = luma(skinTone) < 0.22
  const hairBack = shade(hair, 0.1)
  const hairLine = look.hairColor >= 6 && look.hairColor <= 7 ? shade(hair, 0.45) : shade(hair, 0.5)
  const brow = look.hairColor >= 6 && look.hairColor <= 7 ? shade(hair, 0.35) : shade(hair, 0.15)
  const iris = EYE_COLORS[look.eyeColor] ?? EYE_COLORS[0]
  const outfit = OUTFIT_COLORS[look.outfitColor] ?? OUTFIT_COLORS[0]
  // Hut/Mütze im Kontrast zum Oberteil (nächste Palettenfarbe ≠ Spielerfarbe).
  const hatColor = [1, 2, 3, 4].map((k) => OUTFIT_COLORS[(look.outfitColor + k) % OUTFIT_COLORS.length]).find((c) => c.toLowerCase() !== accentHex.toLowerCase()) ?? outfit
  const head = HEADS[look.head] ?? HEADS.oval
  const fit = head.sx === 1 && head.sy === 1 ? undefined : `translate(100 93) scale(${head.sx} ${head.sy}) translate(-100 -93)`
  const hairL = buildHair(look.hair, {
    headD: head.d,
    fit,
    uid: `av-hr-${uid}`,
    c: hair,
    cs: hairBack,
    line: hairLine,
    shaved: mix(skin, hair, 0.75),
    buzz: against(mix(skin, hair, 0.85), skin),
    rim: luma(hair) < 0.22 ? tint(accentHex, 0.25) : undefined,
  })
  const underHat = HAT.has(look.accessory) ? `url(#${ids.below})` : undefined
  const viewBox = crop === 'face' ? '31 17 138 138' : '16 10 168 168'

  return (
    <svg viewBox={viewBox} xmlns="http://www.w3.org/2000/svg" className={className} role={title ? 'img' : undefined} aria-hidden={title ? undefined : true}>
      {title && <title>{title}</title>}
      <defs>
        <radialGradient id={ids.bg} cx="50%" cy="38%" r="70%">
          <stop offset="0%" stopColor={accentHex} stopOpacity={0.75} />
          <stop offset="55%" stopColor="#19223A" />
          <stop offset="100%" stopColor="#0B1020" />
        </radialGradient>
        <clipPath id={ids.clip}>
          <circle cx={100} cy={100} r={100} />
        </clipPath>
        {/* Bartzone: Wangen ab Ohrhöhe, Bogen über der Oberlippe */}
        <clipPath id={ids.beard}>
          <path d="M30 114 C58 118 80 117 100 116 C120 117 142 118 170 114 L170 200 L30 200 Z" />
        </clipPath>
        <clipPath id={ids.stubble}>
          <path d="M40 106 L66 104 Q78 116 88 122 Q100 126 112 122 Q122 116 134 104 L160 106 L170 200 L30 200 Z" />
        </clipPath>
        <clipPath id={ids.below}>
          <rect x={0} y={78} width={200} height={122} />
        </clipPath>
        <clipPath id={ids.head}>
          <path d={head.d} />
        </clipPath>
        <linearGradient id={ids.shades} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#ffffff" stopOpacity={0.15} />
          <stop offset="100%" stopColor={tint(accentHex, 0.4)} stopOpacity={0.9} />
        </linearGradient>
        <linearGradient id={ids.visor} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#27D8FF" />
          <stop offset="100%" stopColor="#9C82FF" />
        </linearGradient>
      </defs>
      <g clipPath={`url(#${ids.clip})`}>
        <rect width={200} height={200} fill={`url(#${ids.bg})`} />

        <g clipPath={underHat}>{hairL.back}</g>

        {/* Hals */}
        <path d="M88 124 L112 124 L114 156 Q100 163 86 156 Z" fill={skin} stroke={skinLine} strokeWidth={1.6} />
        <path d="M88 130 Q100 146 112 130 L112 140 Q100 153 88 140 Z" fill={skinShade} />

        <Outfit kind={look.outfit} c={outfit} accent={accentHex} skin={skin} />
        <path d={SHOULDER_EDGE} stroke={accentHex} strokeWidth={2.5} fill="none" opacity={0.75} />

        {/* Ohren (bei Frisuren, die sie verdecken, weggelassen) */}
        {!hairL.coversEars && (
        <Both>
          <g transform={`translate(${head.earX - 63} 0)`}>
            <ellipse cx={63} cy={97} rx={8} ry={11.5} fill={skin} stroke={skinLine} strokeWidth={1.6} />
            <ellipse cx={64} cy={97} rx={3.6} ry={6.5} fill={skinShade} opacity={0.7} />
          </g>
        </Both>
        )}

        {/* Kopf */}
        <path d={head.d} fill={skin} stroke={skinLine} strokeWidth={1.6} />
        <g clipPath={`url(#${ids.head})`}>
          <ellipse cx={100} cy={146} rx={34} ry={12} fill={skinShade} />
        </g>


        {look.cheeks === 'blush' && (
          <Both>
            <circle cx={78} cy={112} r={6} fill="#FF8FA6" opacity={0.22} />
          </Both>
        )}
        {look.cheeks === 'freckles' && (
          <Both>
            {[
              [78, 108],
              [83, 111],
              [76, 113],
              [81, 115],
            ].map(([x, y]) => (
              <circle key={`${x}-${y}`} cx={x} cy={y} r={1.1} fill={shade(skin, 0.4)} opacity={0.75} />
            ))}
          </Both>
        )}

        {look.beard === 'stubble' && (
          <g clipPath={`url(#${ids.stubble})`}>
            <path d={head.d} fill={darkSkin ? '#000000' : shade(beardColor, 0.2)} opacity={darkSkin ? 0.42 : 0.32} />
          </g>
        )}
        {look.beard === 'full' && (
          <>
            <g clipPath={`url(#${ids.beard})`}>
              <path d={head.d} fill={beardColor} stroke={darkSkin ? tint(skinTone, 0.35) : hairLine} strokeWidth={1.6} transform="translate(100 96) scale(1 1.16) translate(-100 -96)" />
            </g>
            <ellipse cx={100} cy={123} rx={13} ry={7} fill={skin} />
          </>
        )}

        <Nose kind={look.nose} skin={skin} />
        <Mouth kind={look.mouth} lip={luma(skin) < 0.3 ? '#2A0E18' : LIP} />
        {(look.beard === 'mustache' || look.beard === 'goatee' || look.beard === 'full') && (
          <path d={MUSTACHE} fill={beardColor} stroke={darkSkin ? tint(skinTone, 0.35) : hairLine} strokeWidth={1} transform={`translate(100 115) scale(${1.3 * head.sx} 1.3) translate(-100 -115)`} />
        )}
        {look.beard === 'goatee' && (
          <g clipPath={`url(#${ids.head})`}>
            <path d="M89 130 C89 146 111 146 111 130 C105 134 95 134 89 130 Z" fill={beardColor} stroke={darkSkin ? tint(skinTone, 0.35) : hairLine} strokeWidth={1.2} />
          </g>
        )}

        {/* Augen + Brauen */}
        <Eye kind={look.eyes === 'wink' ? 'round' : look.eyes} iris={iris} lid={skinShade} />
        <g transform={MIRROR}>
          <Eye kind={look.eyes === 'wink' ? 'happy' : look.eyes} iris={iris} lid={skinShade} />
        </g>
        <g transform={look.glasses === 'none' ? undefined : 'translate(0 -3)'}>
          <Both>
            <Brow kind={look.brows} color={brow} />
          </Both>
        </g>

        <Glasses kind={look.glasses} accent={accentHex} ids={ids} earX={head.earX} />
        <g clipPath={underHat}>{hairL.front}</g>
        <g transform={fit}>
          <Accessory kind={look.accessory} earX={63} outfit={hatColor} accent={accentHex} />
        </g>
      </g>
    </svg>
  )
}

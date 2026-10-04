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
const tint = (hex: string, amt: number) => mix(hex, '#ffffff', amt)

const INK = '#1A1420'
const LIP = '#4A1E2B'
const MOUTH = '#3B1626'

// ---------------------------------------------------------------------------
// Geometrie

interface Head {
  d: string
  earX: number
}

const HEADS: Record<AvatarLook['head'], Head> = {
  oval: { d: 'M62 90 C62 60 79 46 100 46 C121 46 138 60 138 90 C138 120 122 140 100 140 C78 140 62 120 62 90 Z', earX: 63 },
  round: { d: 'M59 92 C59 63 77 48 100 48 C123 48 141 63 141 92 C141 120 124 137 100 137 C76 137 59 120 59 92 Z', earX: 60 },
  square: { d: 'M62 84 C62 58 79 46 100 46 C121 46 138 58 138 84 L138 110 C138 128 122 140 100 140 C78 140 62 128 62 110 Z', earX: 63 },
  long: { d: 'M65 88 C65 57 81 43 100 43 C119 43 135 57 135 88 C135 122 120 143 100 143 C80 143 65 122 65 88 Z', earX: 66 },
}

/** Frisuren, die die Ohren verdecken. */
const COVERS_EARS = new Set<AvatarLook['hair']>(['long', 'bob', 'locs', 'afro'])
/** Mit Cap/Mütze ersetzt der Hut das Deckhaar; kurze Schnitte zeigen nur Koteletten. */
const HAT = new Set<AvatarLook['accessory']>(['cap', 'beanie'])
const SHORT_UNDER_HAT = new Set<AvatarLook['hair']>(['short', 'quiff', 'spiky', 'buzz', 'curly', 'mohawk'])

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

interface HairParts {
  back?: ReactNode
  sides?: ReactNode
  front?: ReactNode
}

function curlRow(cx: number, cy: number, rx: number, ry: number, from: number, to: number, n: number, r: number, fill: string) {
  return Array.from({ length: n }, (_, i) => {
    const a = ((from + ((to - from) * i) / (n - 1)) * Math.PI) / 180
    return <circle key={i} cx={cx + rx * Math.cos(a)} cy={cy + ry * Math.sin(a)} r={r} fill={fill} />
  })
}

/** Koteletten: verbinden kurze Frisuren mit dem Kopf (kein „Helm"). */
function Sideburns({ c }: { c: string }) {
  return (
    <Both>
      <path d="M61 78 L71 80 Q69 92 66.5 103 Q63 96 61 78 Z" fill={c} />
    </Both>
  )
}

function hairParts(style: AvatarLook['hair'], c: string, cs: string, headClip: string, skin: string): HairParts {
  /** Rasierte Partie: deckend, Hautton mit Haarfarbe gemischt (kein Transparenz-Schleier). */
  const shaved = mix(skin, c, 0.45)
  const slick = 'M62 88 C61 56 80 39 100 39 C120 39 139 56 138 88 C135 70 124 61 110 60 Q104 60 100 64 Q96 60 90 60 C76 61 65 70 62 88 Z'
  switch (style) {
    case 'short':
      return {
        front: (
          <>
            <Sideburns c={c} />
            <path d="M60 92 C54 60 74 38 102 38 C128 38 146 58 140 92 C138 80 134 72 130 68 C118 74 94 74 76 64 C68 72 63 80 60 92 Z" fill={c} />
            <path d="M90 44 Q85 54 78 62" stroke={cs} strokeWidth={2} fill="none" strokeLinecap="round" />
          </>
        ),
      }
    case 'quiff':
      return {
        front: (
          <>
            <Sideburns c={c} />
            <path d="M60 90 C56 62 70 46 86 42 C90 28 112 22 130 32 C144 42 146 64 140 90 C136 76 130 68 124 64 C110 68 90 70 74 64 C68 72 62 80 60 90 Z" fill={c} />
            <path d="M92 40 C100 30 116 28 126 36" stroke={tint(c, 0.25)} strokeWidth={2.5} fill="none" strokeLinecap="round" opacity={0.7} />
          </>
        ),
      }
    case 'spiky':
      return {
        front: (
          <>
            <Sideburns c={c} />
            <path d="M60 90 L57 66 L68 69 L67 50 L80 56 L85 38 L96 49 L104 33 L112 49 L123 38 L125 56 L137 50 L134 69 L143 66 L140 90 C134 74 120 66 100 66 C80 66 66 74 60 90 Z" fill={c} />
          </>
        ),
      }
    case 'buzz':
      return {
        front: (
          <g clipPath={`url(#${headClip})`}>
            <path d="M40 30 L160 30 L160 86 C142 70 124 64 110 64 Q104 64 100 67 Q96 64 90 64 C76 64 58 70 40 86 Z" fill={mix(skin, c, 0.75)} />
          </g>
        ),
      }
    case 'curly':
      return {
        back: <ellipse cx={100} cy={78} rx={44} ry={38} fill={cs} />,
        front: (
          <>
            <path d="M60 90 C58 56 78 40 100 40 C122 40 142 56 140 90 C134 76 120 70 100 70 C80 70 66 76 60 90 Z" fill={c} />
            {curlRow(100, 84, 39, 40, 188, 352, 11, 10, c)}
            {curlRow(100, 72, 28, 8, 200, 340, 6, 8, c)}
          </>
        ),
      }
    case 'afro':
      return {
        back: (
          <>
            <circle cx={100} cy={76} r={52} fill={cs} />
            {curlRow(100, 76, 50, 50, 150, 390, 14, 11, cs)}
          </>
        ),
        front: (
          <>
            <path d="M60 84 C62 64 80 58 100 58 C120 58 138 64 140 84 C142 56 124 40 100 40 C76 40 58 56 60 84 Z" fill={c} />
            {curlRow(100, 66, 36, 8, 195, 345, 7, 6.5, c)}
          </>
        ),
      }
    case 'mohawk':
      return {
        front: (
          <>
            <g clipPath={`url(#${headClip})`}>
              <path d="M40 30 L160 30 L160 84 C140 68 122 63 100 63 C78 63 60 68 40 84 Z" fill={shaved} />
            </g>
            <path d="M76 72 C70 52 80 34 100 30 C120 34 130 52 124 72 C112 64 88 64 76 72 Z" fill={c} />
            <path d="M100 30 C95 40 94 52 96 64" stroke={tint(c, 0.25)} strokeWidth={2} fill="none" opacity={0.5} />
          </>
        ),
      }
    case 'bob':
      return {
        back: <path d="M54 92 C52 54 76 34 100 34 C124 34 148 54 146 92 L148 132 C140 138 130 136 126 130 L74 130 C70 136 60 138 52 132 Z" fill={cs} />,
        front: <path d="M58 92 C56 56 78 38 100 38 C122 38 144 56 142 92 C136 84 132 76 130 70 C112 74 88 74 70 70 C68 78 64 86 58 92 Z" fill={c} />,
      }
    case 'long':
      return {
        back: <path d="M58 90 C56 54 78 36 100 36 C122 36 144 54 142 90 L146 158 C130 166 70 166 54 158 Z" fill={cs} />,
        sides: (
          <Both>
            <path d="M61 80 C52 106 48 136 54 160 Q64 170 76 162 C70 148 68 134 67 120 C66 106 66 96 68 88 Z" fill={c} />
          </Both>
        ),
        front: <path d="M60 98 C55 58 78 38 100 38 C122 38 145 58 140 98 C135 80 126 68 110 62 Q103 59 100 54 Q97 59 90 62 C74 68 65 80 60 98 Z" fill={c} />,
      }
    case 'ponytail':
      return {
        back: (
          <>
            <path d="M122 52 C148 48 166 72 163 102 C161 120 154 134 145 142 C149 124 150 108 145 94 C141 84 136 75 126 68 Z" fill={c} />
            <ellipse cx={135} cy={60} rx={6} ry={8.5} fill={shade(c, 0.45)} transform="rotate(-35 135 60)" />
          </>
        ),
        front: <path d={slick} fill={c} />,
      }
    case 'bun':
      return {
        front: (
          <>
            <circle cx={100} cy={33} r={15} fill={cs} />
            <path d="M88 40 Q100 44 112 40" stroke={shade(c, 0.4)} strokeWidth={2.5} fill="none" />
            <path d={slick} fill={c} />
            <path d="M84 46 C92 41 108 41 116 46" stroke={tint(c, 0.25)} strokeWidth={2} fill="none" opacity={0.6} />
          </>
        ),
      }
    case 'locs':
      return {
        back: (
          <>
            <ellipse cx={100} cy={72} rx={47} ry={36} fill={cs} />
            <Both>
              <path d="M62 76 C52 100 50 130 56 156 Q62 160 66 154 C62 130 64 104 70 84 Z" fill={cs} />
              <path d="M70 84 C64 108 64 134 70 158 Q76 161 79 155 C74 132 74 108 78 92 Z" fill={c} />
            </Both>
          </>
        ),
        front: (
          <>
            <path d="M60 88 C58 56 78 40 100 40 C122 40 142 56 140 88 C134 70 120 62 100 62 C80 62 66 70 60 88 Z" fill={c} />
          </>
        ),
      }
    case 'bald':
      return { front: <ellipse cx={86} cy={60} rx={10} ry={5} fill="#ffffff" opacity={0.12} transform="rotate(-20 86 60)" stroke="none" /> }
  }
}

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

function Mouth({ kind }: { kind: AvatarLook['mouth'] }) {
  const line = { stroke: LIP, strokeWidth: 3.6, fill: 'none', strokeLinecap: 'round' as const }
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

const LOWER_FACE =
  'M60 100 C60 132 80 146 100 146 C120 146 140 132 140 100 C134 116 124 112 116 114 C110 112 104 112 100 113 C96 112 90 112 84 114 C76 112 66 116 60 100 Z'
const FULL_BEARD =
  'M61 102 C60 136 80 152 100 152 C120 152 140 136 139 102 C134 116 124 114 116 115 C110 113 104 113 100 114 C96 113 90 113 84 115 C76 114 66 116 61 102 Z'
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
            <rect x={earX - 14} y={86} width={18} height={28} rx={8} fill="#1E2238" />
            <rect x={earX - 11} y={89} width={9} height={22} rx={4.5} fill={accent} />
          </Both>
        </>
      )
    case 'cap':
      return (
        <>
          <path d="M60 80 C60 50 80 40 100 40 C120 40 140 50 140 80 Z" fill={outfit} />
          <path d="M58 80 C76 72 124 72 142 80 C138 90 62 90 58 80 Z" fill={os} />
          <path d="M100 41 L100 78" stroke={os} strokeWidth={1.4} opacity={0.6} />
          <circle cx={100} cy={41} r={3.2} fill={os} />
        </>
      )
    case 'beanie':
      return (
        <>
          <path d="M58 82 C56 50 78 38 100 38 C122 38 144 50 142 82 Z" fill={outfit} />
          <path d="M57 72 L143 72 L144 85 Q100 80 56 85 Z" fill={os} />
          {[66, 78, 90, 102, 114, 126, 136].map((x) => (
            <path key={x} d={`M${x} 73 L${x} 83`} stroke={shade(outfit, 0.4)} strokeWidth={1.4} opacity={0.5} />
          ))}
          <circle cx={100} cy={36} r={8} fill={tint(outfit, 0.35)} />
        </>
      )
    case 'earrings':
      return (
        <Both>
          <circle cx={earX - 1} cy={113} r={5} fill="none" stroke="#F0C04A" strokeWidth={2.4} />
          <circle cx={earX - 1} cy={108.4} r={1.6} fill="#F0C04A" />
        </Both>
      )
    case 'partyhat':
      return (
        <g transform="rotate(12 100 58) translate(0 6)">
          <path d="M82 56 L74 132" stroke="#ffffff" strokeWidth={1} opacity={0.45} />
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
  }
  const skin = SKIN_TONES[look.skin] ?? SKIN_TONES[2]
  const skinShade = shade(skin, 0.14)
  // Konturen: halten Haar/Haut auch klein und bei ähnlichen Tönen auseinander.
  const skinLine = shade(skin, 0.38)
  const hair = HAIR_COLORS[look.hairColor] ?? HAIR_COLORS[2]
  const hairBack = shade(hair, 0.1)
  const hairLine = look.hairColor >= 6 && look.hairColor <= 7 ? shade(hair, 0.45) : shade(hair, 0.5)
  const brow = look.hairColor >= 6 && look.hairColor <= 7 ? shade(hair, 0.35) : shade(hair, 0.15)
  const iris = EYE_COLORS[look.eyeColor] ?? EYE_COLORS[0]
  const outfit = OUTFIT_COLORS[look.outfitColor] ?? OUTFIT_COLORS[0]
  // Hut/Mütze im Kontrast zum Oberteil (nächste Palettenfarbe ≠ Spielerfarbe).
  const hatColor = [1, 2, 3, 4].map((k) => OUTFIT_COLORS[(look.outfitColor + k) % OUTFIT_COLORS.length]).find((c) => c.toLowerCase() !== accentHex.toLowerCase()) ?? outfit
  const head = HEADS[look.head] ?? HEADS.oval
  const hairP = hairParts(look.hair, hair, hairBack, ids.head, skin)
  const viewBox = crop === 'face' ? '31 20 138 138' : '16 14 168 168'

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

        <g stroke={hairLine} strokeWidth={1.6} clipPath={HAT.has(look.accessory) ? `url(#${ids.below})` : undefined}>
          {hairP.back}
        </g>

        {/* Hals */}
        <path d="M88 124 L112 124 L114 156 Q100 163 86 156 Z" fill={skin} stroke={skinLine} strokeWidth={1.6} />
        <path d="M88 130 Q100 146 112 130 L112 140 Q100 153 88 140 Z" fill={skinShade} />

        <Outfit kind={look.outfit} c={outfit} accent={accentHex} skin={skin} />
        <path d={SHOULDER_EDGE} stroke={accentHex} strokeWidth={2.5} fill="none" opacity={0.75} />

        {/* Ohren (bei Frisuren, die sie verdecken, weggelassen) */}
        {!COVERS_EARS.has(look.hair) && (
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

        <g stroke={hairLine} strokeWidth={1.6}>{hairP.sides}</g>

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
          <g clipPath={`url(#${ids.head})`}>
            <path d={LOWER_FACE} fill={hair} opacity={0.28} />
          </g>
        )}
        {look.beard === 'full' && (
          <>
            <path d={FULL_BEARD} fill={hair} />
            <ellipse cx={100} cy={123} rx={14} ry={7} fill={skin} />
          </>
        )}

        <Nose kind={look.nose} skin={skin} />
        <Mouth kind={look.mouth} />
        {(look.beard === 'mustache' || look.beard === 'goatee' || look.beard === 'full') && <path d={MUSTACHE} fill={hair} />}
        {look.beard === 'goatee' && <path d="M92 131 C92 141 108 141 108 131 C104 133.5 96 133.5 92 131 Z" fill={hair} />}

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

        <g stroke={hairLine} strokeWidth={1.6}>
          {HAT.has(look.accessory) ? SHORT_UNDER_HAT.has(look.hair) && <Sideburns c={hair} /> : hairP.front}
        </g>
        <Glasses kind={look.glasses} accent={accentHex} ids={ids} earX={head.earX} />
        <Accessory kind={look.accessory} earX={head.earX} outfit={hatColor} accent={accentHex} />
      </g>
    </svg>
  )
}

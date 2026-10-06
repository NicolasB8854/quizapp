/**
 * Frisuren für AvatarFigure, konstruiert aus der Schädelkontur.
 *
 * Prinzip: Die „Haarkappe" ist die Kopfform selbst, leicht nach außen skaliert,
 * und wird von einer Haaransatz-Region (pro Frisur) beschnitten. Dadurch sitzt
 * jede Frisur exakt auf jeder Kopfform — ohne Spalt, Helm-Kante oder Überstand.
 * Volumen (Tolle, Zacken, Iro-Kamm, Dutt, Locken) setzt auf die Kappe auf und
 * überlappt sie; ein gemeinsamer Kontur-Durchgang zeichnet nur den Außenrand
 * der Vereinigung (keine Innenlinien).
 *
 * Koordinaten der Regionen/Volumen sind für den ovalen Kopf entworfen und werden
 * per `fit`-Transform an die übrigen Kopfformen angepasst.
 */
import type { ReactNode } from 'react'
import type { AvatarLook } from '@quizapp/shared'

export interface HairCtx {
  /** Kopfpfad der aktuellen Kopfform (ungeskaliert). */
  headD: string
  /** Transform oval → aktuelle Kopfform (oder undefined). */
  fit: string | undefined
  /** Eindeutiger Präfix für clipPath-IDs. */
  uid: string
  c: string
  /** Etwas dunkler, für Hinterhaar. */
  cs: string
  /** Konturfarbe. */
  line: string
  /** Rasierte Partie (Iro). */
  shaved: string
  /** Buzzcut-Ton. */
  buzz: string
  /** Lichtkante (Spielerfarbe) für dunkles Haar vor dunklem Hintergrund. */
  rim?: string
}

export interface HairLayers {
  /** Hinter Hals/Oberkörper/Kopf. */
  back: ReactNode
  /** Über dem Gesicht. */
  front: ReactNode
  /** Frisur verdeckt die Ohren. */
  coversEars: boolean
}

const around = (sx: number, sy: number, dy = 0) => `translate(100 ${93 + dy}) scale(${sx} ${sy}) translate(-100 -93)`

/** Haaransatz-Regionen (Fläche, in der vorne Haar sein darf). */
const REGION = {
  // Seitenscheitel, Koteletten bis Ohrläppchen-Oberkante
  short: 'M0 0 H200 V99 L133 105 Q134 88 130 72 C116 77 95 76 80 64 C72 72 68 84 68 105 L0 99 Z',
  // höherer Ansatz, nach hinten gekämmt (Zopf, Dutt)
  slick: 'M0 0 H200 V100 H134 Q134 80 128 68 C116 61 106 61 100 63 C94 61 84 61 72 68 Q66 80 66 100 H0 Z',
  // natürlicher Ansatz für Buzz/Iro/Locs
  natural: 'M0 0 H200 V98 H134 Q134 84 131 74 C118 69 108 67 100 69 C92 67 82 69 69 74 Q66 84 66 98 H0 Z',
  curly: 'M0 0 H200 V102 H134 Q136 84 130 72 C116 66 84 66 70 72 Q64 84 66 102 H0 Z',
  afro: 'M0 0 H200 V100 H136 Q136 80 128 68 C114 63 86 63 72 68 Q64 80 64 100 H0 Z',
  // Pony gerade, Seiten bis Kinnlinie
  bob: 'M0 0 H200 V136 H134 V98 Q134 84 130 76 L127 86 L119 75 L113 90 L105 77 L98 92 L90 78 L83 90 L76 77 L70 76 Q66 84 66 98 V136 H0 Z',
  // Mittelscheitel, Seiten fallen über die Gesichtskante
  long: 'M0 0 H200 V150 H135 V102 Q134 80 124 68 C114 63 105 61 100 55 C95 61 86 63 76 68 Q66 80 65 102 V150 H0 Z',
} as const

function curls(cx: number, cy: number, rx: number, ry: number, from: number, to: number, n: number, r: number) {
  return Array.from({ length: n }, (_, i) => {
    const a = ((from + ((to - from) * i) / (n - 1)) * Math.PI) / 180
    return <circle key={i} cx={cx + rx * Math.cos(a)} cy={cy + ry * Math.sin(a)} r={r} />
  })
}

interface Spec {
  /** Kappen-Skalierung (Volumen) und Anhebung. */
  cap?: { k: number; ky?: number; dy?: number; region: keyof typeof REGION; fill?: 'c' | 'shaved' | 'buzz' }
  /** Volumen vorne (in Oval-Koordinaten, Füllung = Haarfarbe). */
  extra?: ReactNode
  /** Hinterhaar in Oval-Koordinaten (gefittet). */
  back?: ReactNode
  /** Hinterhaar aus der Kopfkontur (ungefittet): Skalierung. */
  backCap?: { kx: number; ky: number; dy?: number }
  /** Feine Linien (Scheitel, Glanz, Haargummi) ohne Kontur. */
  detail?: (ctx: HairCtx) => ReactNode
  coversEars?: boolean
}

const SPECS: Record<AvatarLook['hair'], Spec> = {
  short: {
    cap: { k: 1.05, dy: -1, region: 'short' },
    detail: (x) => <path d="M88 47 Q84 56 79 63" stroke={x.line} strokeWidth={1.8} fill="none" strokeLinecap="round" opacity={0.6} />,
  },
  quiff: {
    cap: { k: 1.05, dy: -1, region: 'short' },
    extra: <path d="M68 66 C62 46 80 32 102 31 C124 30 142 40 139 58 C134 52 126 50 118 52 C106 56 86 62 68 66 Z" />,
    detail: () => <path d="M90 36 C100 30 114 30 124 36" stroke="#ffffff" strokeWidth={2} fill="none" strokeLinecap="round" opacity={0.25} />,
  },
  spiky: {
    cap: { k: 1.05, dy: -1, region: 'short' },
    extra: <path d="M66 66 L63 52 L73 54 L73 41 L84 47 L89 33 L98 43 L104 30 L111 43 L121 34 L123 47 L134 42 L133 54 L139 56 L134 68 Z" />,
  },
  buzz: { cap: { k: 1.02, region: 'natural', fill: 'buzz' } },
  curly: {
    cap: { k: 1.08, dy: -2, region: 'curly' },
    extra: (
      <>
        {curls(100, 90, 41, 47, 188, 352, 12, 8.5)}
        {curls(100, 70, 27, 5, 195, 345, 6, 6.5)}
      </>
    ),
  },
  afro: {
    cap: { k: 1.08, dy: -2, region: 'afro' },
    back: (
      <>
        <circle cx={100} cy={76} r={50} />
        {curls(100, 76, 49, 49, 150, 390, 16, 9)}
      </>
    ),
    extra: curls(100, 68, 28, 4, 195, 345, 6, 6),
    coversEars: true,
  },
  mohawk: {
    cap: { k: 1.02, region: 'natural', fill: 'shaved' },
    extra: <path d="M74 72 C66 54 78 37 100 32 C122 37 134 54 126 72 C112 64 88 64 74 72 Z" />,
    detail: () => <path d="M100 36 C95 44 94 54 96 64" stroke="#ffffff" strokeWidth={1.8} fill="none" opacity={0.22} />,
  },
  bob: {
    cap: { k: 1.1, dy: -1, region: 'bob' },
    backCap: { kx: 1.14, ky: 1.06, dy: -2 },
    back: <path d="M55 92 H145 V128 Q145 137 136 137 H64 Q55 137 55 128 Z" />,
    coversEars: true,
  },
  long: {
    cap: { k: 1.08, dy: -1, region: 'long' },
    backCap: { kx: 1.12, ky: 1.05, dy: -1 },
    back: <path d="M57 96 H143 C148 120 150 142 147 160 Q100 170 53 160 C50 142 52 120 57 96 Z" />,
    coversEars: true,
  },
  ponytail: {
    cap: { k: 1.04, region: 'slick' },
    back: <path d="M116 56 C142 52 157 72 155 98 C153 114 147 126 140 132 C143 118 143 104 138 92 C134 82 128 76 118 72 Z" />,
    detail: (x) => <ellipse cx={129} cy={60} rx={4} ry={6.5} fill={x.line} transform="rotate(-35 129 60)" />,
  },
  bun: {
    cap: { k: 1.04, region: 'slick' },
    extra: <circle cx={100} cy={41} r={17} />,
    detail: (x) => <path d="M87 51 Q100 55 113 51" stroke={x.line} strokeWidth={3} fill="none" strokeLinecap="round" />,
  },
  locs: {
    cap: { k: 1.06, dy: -1, region: 'natural' },
    backCap: { kx: 1.1, ky: 1.04, dy: -1 },
    back: (
      <>
        {[56, 64, 72].map((x, i) => (
          <g key={x}>
            <path d={`M${x} 90 C${x - 4} 116 ${x - 4} 140 ${x - 1} ${158 - i * 4} Q${x + 3} ${161 - i * 4} ${x + 6} ${156 - i * 4} C${x + 4} 136 ${x + 5} 114 ${x + 8} 92 Z`} />
            <path d={`M${200 - x} 90 C${204 - x} 116 ${204 - x} 140 ${201 - x} ${158 - i * 4} Q${197 - x} ${161 - i * 4} ${194 - x} ${156 - i * 4} C${196 - x} 136 ${195 - x} 114 ${192 - x} 92 Z`} />
          </g>
        ))}
      </>
    ),
    coversEars: true,
  },
  bald: {},
}

export function buildHair(style: AvatarLook['hair'], x: HairCtx): HairLayers {
  const spec = SPECS[style] ?? {}
  const regionId = `${x.uid}-hl`

  const capFill = spec.cap?.fill === 'shaved' ? x.shaved : spec.cap?.fill === 'buzz' ? x.buzz : x.c
  const cap = spec.cap && (
    <g clipPath={`url(#${regionId})`}>
      <path d={x.headD} fill={capFill} transform={around(spec.cap.k, spec.cap.ky ?? spec.cap.k, spec.cap.dy ?? 0)} />
    </g>
  )
  const extra = spec.extra && (
    <g fill={x.c} transform={x.fit}>
      {spec.extra}
    </g>
  )
  const frontShapes = (
    <>
      {cap}
      {extra}
    </>
  )
  const backShapes = (spec.back || spec.backCap) && (
    <>
      {spec.backCap && <path d={x.headD} transform={around(spec.backCap.kx, spec.backCap.ky, spec.backCap.dy ?? 0)} />}
      {spec.back && <g transform={x.fit}>{spec.back}</g>}
    </>
  )

  // Kontur-Durchgang (breite Linie) unter dem Füll-Durchgang → nur der Außenrand bleibt sichtbar.
  const twoPass = (shapes: ReactNode, fill: string) => (
    <>
      {x.rim && (
        <g fill="none" stroke={x.rim} strokeOpacity={1} strokeWidth={9} strokeLinejoin="round">
          {shapes}
        </g>
      )}
      <g fill={fill} stroke={x.line} strokeWidth={3.2} strokeLinejoin="round">
        {shapes}
      </g>
      <g fill={fill} stroke="none">
        {shapes}
      </g>
    </>
  )

  return {
    coversEars: !!spec.coversEars,
    back: backShapes ? twoPass(backShapes, x.cs) : null,
    front: (
      <>
        {spec.cap && (
          <defs>
            <clipPath id={regionId}>
              <path d={REGION[spec.cap.region]} transform={x.fit} />
            </clipPath>
          </defs>
        )}
        {(cap || extra) && twoPass(frontShapes, x.c)}
        {spec.detail && <g transform={x.fit}>{spec.detail(x)}</g>}
      </>
    ),
  }
}

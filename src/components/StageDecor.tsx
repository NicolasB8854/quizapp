/**
 * Ambient-Deko für die Show-Bühne (Session U).
 *
 * Bündelt drei Layer, die den Game-Screen wie ein TV-Studio wirken lassen:
 *
 *  1. Neon-Cursive-Schild links: „Good Questions · Better People" — dekorative
 *     Handschrift in Cyan-Neon (Font `script` = Caveat).
 *  2. „Wissen verbindet"-Badge unten rechts: kleiner Neon-Kreis mit Bogen-Text —
 *     das Design-Manifest der App als visueller Anker.
 *  3. AudienceSilhouettes unten: dunkle Kopf-Schulter-Silhouetten mit Rim-Light.
 *
 * Alle drei Layer sind `pointer-events: none` und liegen zwischen Foto-Backdrop
 * (z-0) und Content (z-10). Auf mobilen Geräten sind die Deko-Elemente kleiner
 * oder komplett ausgeblendet, damit der Content Platz behält.
 */

import { AudienceSilhouettes } from './AudienceSilhouettes'

export function StageDecor() {
  return (
    <>
      {/* Neon-Cursive-Schild links */}
      <div
        aria-hidden
        className="pointer-events-none fixed left-4 md:left-8 top-24 md:top-32 z-[6] hidden lg:block select-none"
      >
        <NeonSign />
      </div>

      {/* „Wissen verbindet"-Badge rechts unten */}
      <div
        aria-hidden
        className="pointer-events-none fixed right-6 md:right-10 bottom-16 md:bottom-20 z-[6] hidden md:block select-none"
      >
        <KnowledgeBadge />
      </div>

      {/* Publikums-Silhouetten unten */}
      <AudienceSilhouettes />
    </>
  )
}

/**
 * Neon-Cursive-Schild: mehrzeiliger Schriftzug mit Cyan-Neon-Glow. Bewusst
 * schlicht — kein Rahmen, nur die leuchtende Schrift und ein schwacher Halo.
 */
function NeonSign() {
  return (
    <div
      className="relative font-script leading-[0.9] text-[38px] xl:text-[46px]"
      style={{
        color: '#EAFBFF',
        textShadow:
          '0 0 6px rgba(39, 216, 255, 0.85),' +
          '0 0 14px rgba(39, 216, 255, 0.7),' +
          '0 0 34px rgba(39, 216, 255, 0.45)',
      }}
    >
      <div>Good</div>
      <div className="ml-4">Questions</div>
      <div className="ml-1">Better</div>
      <div className="ml-6">People</div>
    </div>
  )
}

/**
 * „Wissen verbindet"-Badge: kreisförmiges Erdkugel-artiges Element mit
 * Umlaufbahn (SVG-Path) — Text sitzt auf einem Bogen. Kompakt gestaltet,
 * damit es nicht mit dem Content konkurriert.
 */
function KnowledgeBadge() {
  const uid = 'stage-badge-arc'
  return (
    <div className="relative h-32 w-32">
      {/* Erdkugel-Illusion: Halbkreis-Gradient */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 50% 65%, rgba(39,216,255,0.35) 0%, rgba(39,216,255,0) 55%),' +
            'radial-gradient(circle at 35% 40%, rgba(124,92,255,0.25) 0%, rgba(124,92,255,0) 65%)',
          boxShadow: '0 0 22px rgba(39,216,255,0.35)',
        }}
      />
      {/* Umlaufring */}
      <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full">
        <defs>
          <path
            id={uid}
            d="M 20 60 A 40 40 0 1 1 100 60"
            fill="transparent"
          />
        </defs>
        <circle
          cx="60"
          cy="60"
          r="42"
          fill="none"
          stroke="rgba(124,92,255,0.35)"
          strokeWidth="0.75"
        />
        <text
          fill="#F5F7FF"
          className="font-display"
          style={{
            fontSize: '11px',
            letterSpacing: '0.28em',
            fontWeight: 700,
          }}
        >
          <textPath xlinkHref={`#${uid}`} startOffset="50%" textAnchor="middle">
            WISSEN VERBINDET
          </textPath>
        </text>
        {/* Kleiner Puls unten in der Mitte */}
        <circle
          cx="60"
          cy="88"
          r="2.5"
          fill="#27D8FF"
          style={{ filter: 'drop-shadow(0 0 6px rgba(39,216,255,0.9))' }}
        />
      </svg>
    </div>
  )
}

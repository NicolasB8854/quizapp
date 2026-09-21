/**
 * Ambient-Deko für die Show-Bühne (Session U, verstärkt in Session V).
 *
 * Bündelt drei Layer, die den Game-Screen wie ein TV-Studio wirken lassen:
 *
 *  1. Neon-Cursive-Schild links: „Good Questions · Better People" — dekorative
 *     Handschrift in kräftigem Cyan-Neon (Caveat), mit mehrschichtigem Glow.
 *     Ab `md`-Breakpoint sichtbar, nicht erst ab `lg`, weil das Element ein
 *     zentraler Show-Anker ist.
 *  2. „Wissen verbindet"-Badge unten rechts: Neon-Kreis mit Umlauftext auf
 *     einer Bahn, deutlicher Cyan-Glow.
 *  3. AudienceSilhouettes unten: dunkle Kopf-Schulter-Silhouetten mit Rim-Light.
 *
 * Alle drei Layer sind `pointer-events: none`. Auf mobilen Geräten sind die
 * beiden Text-Elemente kleiner oder ausgeblendet, damit der Content atmet.
 */

import { AudienceSilhouettes } from './AudienceSilhouettes'

export function StageDecor() {
  return (
    <>
      {/* Neon-Cursive-Schild links */}
      <div
        aria-hidden
        className="pointer-events-none fixed left-3 md:left-6 lg:left-10 top-20 md:top-24 lg:top-32 z-[6] hidden md:block select-none"
      >
        <NeonSign />
      </div>

      {/* „Wissen verbindet"-Badge rechts unten */}
      <div
        aria-hidden
        className="pointer-events-none fixed right-4 md:right-8 lg:right-10 bottom-20 md:bottom-24 lg:bottom-28 z-[6] hidden md:block select-none"
      >
        <KnowledgeBadge />
      </div>

      {/* Publikums-Silhouetten unten */}
      <AudienceSilhouettes />
    </>
  )
}

/**
 * Neon-Cursive-Schild: mehrzeilige Handschrift mit mehrschichtigem Cyan-Glow.
 * Der Text hat einen weichen inneren Textkern (fast weiß) und mehrere Glow-
 * Ebenen darum, wie eine echte Neon-Röhre.
 */
function NeonSign() {
  return (
    <div
      className="relative font-script leading-[0.85] text-[52px] md:text-[60px] lg:text-[72px] font-bold"
      style={{
        color: '#F0FCFF',
        textShadow:
          '0 0 4px #fff,' +
          '0 0 10px #27D8FF,' +
          '0 0 22px #27D8FF,' +
          '0 0 42px rgba(39, 216, 255, 0.9),' +
          '0 0 78px rgba(39, 216, 255, 0.6)',
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
 * „Wissen verbindet"-Badge: kreisförmiges Element mit Umlauftext auf einer
 * Bahn und einem inneren Glow-Kern (Erdkugel-Illusion). Größer und heller
 * als in Session U — damit es aus der dunklen Bühne herausstrahlt.
 */
function KnowledgeBadge() {
  const uid = 'stage-badge-arc'
  return (
    <div className="relative h-40 w-40 md:h-44 md:w-44">
      {/* Erdkugel-Illusion: mehrschichtige Radial-Gradients */}
      <div
        className="absolute inset-1 rounded-full"
        style={{
          background:
            'radial-gradient(circle at 50% 70%, rgba(39,216,255,0.55) 0%, rgba(39,216,255,0) 55%),' +
            'radial-gradient(circle at 35% 40%, rgba(124,92,255,0.45) 0%, rgba(124,92,255,0) 65%),' +
            'radial-gradient(circle at 65% 55%, rgba(255,61,139,0.15) 0%, rgba(255,61,139,0) 55%)',
          boxShadow:
            '0 0 24px rgba(39,216,255,0.6), 0 0 56px rgba(39,216,255,0.35)',
        }}
      />
      {/* Umlaufring + Text */}
      <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full">
        <defs>
          <path
            id={uid}
            d="M 18 60 A 42 42 0 1 1 102 60"
            fill="transparent"
          />
        </defs>
        <circle
          cx="60"
          cy="60"
          r="46"
          fill="none"
          stroke="rgba(39,216,255,0.65)"
          strokeWidth="1"
        />
        <circle
          cx="60"
          cy="60"
          r="44"
          fill="none"
          stroke="rgba(124,92,255,0.35)"
          strokeWidth="0.75"
          strokeDasharray="2 4"
        />
        <text
          fill="#EAFBFF"
          className="font-display"
          style={{
            fontSize: '10.5px',
            letterSpacing: '0.32em',
            fontWeight: 800,
            filter: 'drop-shadow(0 0 6px rgba(39,216,255,0.9))',
          }}
        >
          <textPath xlinkHref={`#${uid}`} startOffset="50%" textAnchor="middle">
            WISSEN VERBINDET
          </textPath>
        </text>
        {/* Kleiner Neon-Puls unten in der Mitte */}
        <circle
          cx="60"
          cy="92"
          r="3"
          fill="#27D8FF"
          style={{ filter: 'drop-shadow(0 0 8px #27D8FF)' }}
        />
      </svg>
    </div>
  )
}

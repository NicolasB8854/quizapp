/**
 * Silhouetten am unteren Bildrand — Kopf-/Schulterlinien wie im PDF-Wohnzimmer-Mockup.
 *
 * Drei zusammenwirkende Layer:
 *  1. TV-Reflex-Glow am Boden (warmes Purple/Cyan) — beleuchtet die Bühne von hinten.
 *  2. SVG-Silhouetten (fast schwarz) davor — der dunkle Vordergrund.
 *  3. Neon-Rim-Light entlang der Silhouetten-Oberkante — dünner Purple-Umriss, sodass die
 *     Silhouetten auch auf ganz dunklem Grund sichtbar bleiben.
 */

interface Props {
  mode?: 'fixed' | 'absolute'
}

export function AudienceSilhouettes({ mode = 'fixed' }: Props) {
  const positioning =
    mode === 'fixed'
      ? 'fixed inset-x-0 bottom-0'
      : 'absolute inset-x-0 bottom-0'
  return (
    <div
      aria-hidden
      className={`${positioning} pointer-events-none z-[5] h-[26vh] md:h-[30vh] overflow-hidden`}
    >
      {/* 1) TV-Reflex am Boden — projiziert kaltes Licht nach vorne, mischt sich mit warmer Lampe rechts */}
      <div
        className="absolute inset-x-0 bottom-0 h-full"
        style={{
          background:
            'radial-gradient(60% 90% at 50% 100%, rgba(124,92,255,0.35) 0%, rgba(124,92,255,0) 55%),' +
            'radial-gradient(45% 75% at 25% 100%, rgba(39,216,255,0.22) 0%, rgba(39,216,255,0) 60%),' +
            'radial-gradient(45% 70% at 85% 100%, rgba(255,138,58,0.20) 0%, rgba(255,138,58,0) 60%),' +
            'linear-gradient(180deg, rgba(4,6,15,0) 0%, rgba(4,6,15,0.35) 60%, #04060F 100%)',
        }}
      />

      {/* 3) Rim-Light: dünner Neon-Purple-Umriss entlang der Silhouetten-Oberkante */}
      <svg
        viewBox="0 0 1440 300"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-x-0 bottom-0 h-full w-full"
        style={{ filter: 'drop-shadow(0 0 12px rgba(124,92,255,0.55))' }}
      >
        <path
          d="M0 220
             C 40 218, 65 213, 95 205
             C 130 197, 150 181, 165 163
             C 180 145, 205 131, 235 131
             C 265 131, 290 151, 305 173
             C 320 195, 340 213, 385 221
             C 440 229, 485 231, 515 243
             C 545 255, 585 253, 620 239
             C 650 227, 675 209, 700 187
             C 730 161, 770 141, 810 148
             C 850 155, 878 179, 900 203
             C 922 227, 950 243, 995 243
             C 1040 243, 1080 229, 1108 213
             C 1136 197, 1160 178, 1188 161
             C 1218 141, 1250 135, 1285 145
             C 1315 155, 1340 171, 1365 193
             C 1394 217, 1422 231, 1440 235"
          fill="none"
          stroke="rgba(180,155,255,0.55)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>

      {/* 2) Silhouetten selbst — pechschwarz, damit sie sich klar vom Ambient absetzen */}
      <svg
        viewBox="0 0 1440 300"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-x-0 bottom-0 h-full w-full"
      >
        <path
          fill="#04060F"
          d="M0 300 L0 220
             C 40 220, 65 215, 95 207
             C 130 199, 150 183, 165 165
             C 180 147, 205 133, 235 133
             C 265 133, 290 153, 305 175
             C 320 197, 340 215, 385 223
             C 440 231, 485 233, 515 245
             C 545 257, 585 255, 620 241
             C 650 229, 675 211, 700 189
             C 730 163, 770 143, 810 150
             C 850 157, 878 181, 900 205
             C 922 229, 950 245, 995 245
             C 1040 245, 1080 231, 1108 215
             C 1136 199, 1160 180, 1188 163
             C 1218 143, 1250 137, 1285 147
             C 1315 157, 1340 173, 1365 195
             C 1394 219, 1422 233, 1440 237
             L 1440 300 Z"
        />
      </svg>
    </div>
  )
}

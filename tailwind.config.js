/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // Sticky-Hover-Bug auf Touch-Geräten fixen: Tailwind 3.4 packt bei diesem
  // Flag alle `hover:`-Klassen unter `@media (hover: hover)`. Nach einem Tap
  // auf dem Handy bleibt der Browser sonst im `:hover`-Zustand hängen und
  // die letzte getappte Option leuchtet in der nächsten Frage weiter.
  future: {
    hoverOnlyWhenSupported: true,
  },
  theme: {
    extend: {
      colors: {
        // Palette aus dem Designkonzept v1 (PDF).
        // Dark-Navy-Basis, Purple als Marke, Cyan als Interaktions-Akzent.
        navy: {
          900: '#0B1020', // Midnight – primärer Hintergrund / Bühne
          800: '#131A2E', // Deep – sekundäre Flächen / Panels
          700: '#19223A', // Card – Cards, Antwortfelder, Statusmodule
          600: '#232C4A', // Card-Hover
          500: '#2E385A',
        },
        brand: {
          purple: '#7C5CFF',        // Electric Purple – Brand / CTA / Fokus
          'purple-soft': '#9C82FF',
          'purple-deep': '#5A3EE0',
          cyan: '#27D8FF',          // Electric Cyan – Ready-State / Interaktion
          'cyan-soft': '#7EE7FF',
          // Session R: Team-Farben 3 und 4 (Multi-Team). Aus mode.sprinter / mode.flash
          // abgeleitet, damit die Palette einheitlich bleibt.
          orange: '#FF6E5C',
          'orange-soft': '#FF9587',
          pink: '#FF3D8B',
          'pink-soft': '#FF77B0',
        },
        ink: {
          DEFAULT: '#F5F7FF',       // Off White – Primärtext
          muted: '#9AA4BD',         // Muted Blue Grey – Sekundärtext / Meta
          faint: '#5A6485',
        },
        // Feedback-Farben (aus PDF: „Cyan/Green Flash" bei richtig, „Red Pulse" bei falsch)
        correct: '#3FD98B',
        wrong: '#FF5C7A',
        // Modus-Akzente (aus PDF „4. Farben je Spielmodus")
        mode: {
          board:     '#F0B23A', // Punktejagd        – Wissen / klassisch → warmes Gold
          sprinter:  '#FF6E5C', // Sprinter          – Druck / Tempo   → Rot-Orange
          ladder:    '#E9C46A', // Alles oder Nichts – Spannung / Premium → sattes Gold
          corner:    '#F4A261', // Klick!            – Warm-up / Humor → warmes Orange
          experts:   '#B78BFF', // Fachrunde         – Expertise → helles Lila
          flash:     '#FF3D8B', // Blitzrunde        – Speed / Energie → Neon-Pink
          duel:      '#27D8FF', // Themen-Battle     – Standard Cyan
          spotlight: '#FFB84D', // Heimspiel         – Persönlich / Bühne → Bernstein
        },
      },
      fontFamily: {
        // Display: Bricolage Grotesque — moderne, geometrische Grotesk mit Show-Charakter.
        // Kommt dem Neue-Haas-Grotesk-Look der Mockups deutlich näher als Space Grotesk.
        // Body: Inter für UI, Navigation, Fragen und Meta.
        display: ['"Bricolage Grotesque"', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        sans:    ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      boxShadow: {
        // Sanfte Glows für Fokus/Auswahl (siehe Guardrails: „Glow nur bei Fokus").
        'glow-purple': '0 0 0 1px rgba(124,92,255,0.35), 0 12px 40px -8px rgba(124,92,255,0.55)',
        'glow-cyan':   '0 0 0 1px rgba(39,216,255,0.35), 0 12px 40px -8px rgba(39,216,255,0.55)',
        // Session R: Team-Farben 3 und 4 (Multi-Team-Support)
        'glow-orange': '0 0 0 1px rgba(255,110,92,0.35), 0 12px 40px -8px rgba(255,110,92,0.55)',
        'glow-pink':   '0 0 0 1px rgba(255,61,139,0.35), 0 12px 40px -8px rgba(255,61,139,0.55)',
        'glow-correct':'0 0 0 1px rgba(63,217,139,0.4),  0 12px 40px -8px rgba(63,217,139,0.55)',
        'glow-wrong':  '0 0 0 1px rgba(255,92,122,0.4),  0 12px 40px -8px rgba(255,92,122,0.55)',
        // Mehrschichtige „Neon"-Glows für die Show-Anker-Elemente (Room-Code, Kategorie-Chip,
        // Antwort-Kreis). Direkt an den Mockups aus dem PDF orientiert.
        'neon-purple':
          '0 0 0 1px rgba(124,92,255,0.55), 0 0 12px rgba(124,92,255,0.55), 0 0 28px rgba(124,92,255,0.35), 0 0 60px rgba(124,92,255,0.25)',
        'neon-cyan':
          '0 0 0 1px rgba(39,216,255,0.55), 0 0 12px rgba(39,216,255,0.55), 0 0 28px rgba(39,216,255,0.35), 0 0 60px rgba(39,216,255,0.25)',
        'neon-orange':
          '0 0 0 1px rgba(255,110,92,0.55), 0 0 12px rgba(255,110,92,0.55), 0 0 28px rgba(255,110,92,0.35), 0 0 60px rgba(255,110,92,0.25)',
        'neon-pink':
          '0 0 0 1px rgba(255,61,139,0.55), 0 0 12px rgba(255,61,139,0.55), 0 0 28px rgba(255,61,139,0.35), 0 0 60px rgba(255,61,139,0.25)',
        card: '0 12px 40px -20px rgba(0,0,0,0.6)',
      },
      borderRadius: {
        // Radius 14–18 px laut Komponenten-Sprache im PDF.
        card: '18px',
        btn: '14px',
      },
      backgroundImage: {
        // Wohnzimmer-Ambient (kein Foto-Asset): warmer Lampenschein rechts oben, kühles
        // Neon-Purple/Cyan links + zentraler TV-Bereich, dunkler Rand oben — direkt aus den
        // PDF-Mockups abgeleitet.
        'stage':
          // warme Deckenlampe rechts oben
          'radial-gradient(40% 40% at 92% 12%, rgba(255,138,58,0.42) 0%, rgba(255,138,58,0) 60%),' +
          // Purple-Neon links oben (Wandbeleuchtung)
          'radial-gradient(55% 50% at 6% 22%, rgba(124,92,255,0.42) 0%, rgba(124,92,255,0) 65%),' +
          // Cyan-TV-Schimmer mittig
          'radial-gradient(60% 50% at 58% 42%, rgba(39,216,255,0.26) 0%, rgba(39,216,255,0) 60%),' +
          // warm Amber unten rechts (zweite Lichtquelle)
          'radial-gradient(40% 30% at 88% 92%, rgba(255,108,42,0.25) 0%, rgba(255,108,42,0) 65%),' +
          // Pink-Neon Kante unten links
          'radial-gradient(35% 30% at 12% 92%, rgba(255,61,139,0.20) 0%, rgba(255,61,139,0) 65%),' +
          // Grunddunkel — oben fast schwarz, unten Navy
          'linear-gradient(180deg, #02040D 0%, #0A0F22 45%, #0B1020 100%)',
        // Etwas dichter — für Screens, in denen der Content selbst schon leuchtet (Gameplay).
        'stage-tight':
          'radial-gradient(45% 45% at 10% 12%, rgba(124,92,255,0.28) 0%, rgba(124,92,255,0) 65%),' +
          'radial-gradient(45% 45% at 90% 92%, rgba(39,216,255,0.20) 0%, rgba(39,216,255,0) 65%),' +
          'radial-gradient(30% 25% at 80% 8%, rgba(255,153,64,0.14) 0%, rgba(255,153,64,0) 60%),' +
          'linear-gradient(180deg, #04060F 0%, #08091A 100%)',
        'panel':    'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%)',
        'cta':      'linear-gradient(135deg, #8B6DFF 0%, #5A3EE0 100%)',
        'cta-cyan': 'linear-gradient(135deg, #27D8FF 0%, #4B8BFF 100%)',
      },
      keyframes: {
        // Show-Momente aus dem PDF: „Score +X skaliert kurz hoch", „Red Pulse", „Full-Screen Titelkarte".
        pop:       { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.18)' }, '100%': { transform: 'scale(1)' } },
        pulseWrong:{ '0%,100%': { boxShadow: '0 0 0 0 rgba(255,92,122,0)' }, '50%': { boxShadow: '0 0 0 12px rgba(255,92,122,0.25)' } },
        flashOk:   { '0%,100%': { backgroundColor: 'transparent' }, '50%': { backgroundColor: 'rgba(63,217,139,0.18)' } },
        titleIn:   { '0%': { opacity: '0', transform: 'translateY(12px) scale(0.98)' }, '100%': { opacity: '1', transform: 'translateY(0) scale(1)' } },
        shimmer:   { '0%,100%': { opacity: '0.65' }, '50%': { opacity: '1' } },
        // Neon-„Atmen" für Anker-Elemente wie Room-Code — sehr subtil, kein Blinken.
        breathe: {
          '0%,100%': {
            boxShadow:
              '0 0 0 1px rgba(124,92,255,0.55), 0 0 12px rgba(124,92,255,0.55), 0 0 28px rgba(124,92,255,0.35), 0 0 60px rgba(124,92,255,0.25)',
          },
          '50%': {
            boxShadow:
              '0 0 0 1px rgba(124,92,255,0.7), 0 0 18px rgba(124,92,255,0.75), 0 0 40px rgba(124,92,255,0.5), 0 0 90px rgba(124,92,255,0.35)',
          },
        },
      },
      animation: {
        pop:        'pop 400ms ease-out',
        pulseWrong: 'pulseWrong 700ms ease-out',
        flashOk:    'flashOk 700ms ease-out',
        titleIn:    'titleIn 350ms ease-out both',
        shimmer:    'shimmer 2.4s ease-in-out infinite',
        breathe:    'breathe 3.6s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}

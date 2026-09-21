/**
 * Kleine Canvas-basierte Confetti-Animation für Party-Feedback.
 *
 * Bewusst ohne externe Dep — die Physik ist simpel genug (~90 LOC):
 * jedes Partikel hat `x, y, vx, vy, rotation, rotationSpeed`, wird pro
 * Frame mit `gravity` beschleunigt und mit `drag` gebremst; die letzten
 * 30 % der Lebensdauer werden ausgefadet.
 *
 * Zwei Varianten:
 *  - `intensity='small'` (~25 Partikel, 1.6 s) für Score-Increment-Feedback,
 *    Start aus dem oberen Bildschirm-Zentrum.
 *  - `intensity='large'` (~90 Partikel, 3.5 s) für den Scoreboard-Winner-Burst,
 *    Start aus den unteren Bildschirm-Ecken nach oben-innen.
 *
 * Respektiert `prefers-reduced-motion`: in diesem Fall wird gar nichts
 * gerendert und `onDone` sofort synchron aufgerufen, damit der Trigger-State
 * korrekt zurückgesetzt wird.
 *
 * Multi-Burst-Support: wenn `token` sich ändert (typisch: numerischer
 * Zähler oder Timestamp), wird ein neuer Burst gestartet — auch wenn die
 * gleiche Intensity/Farbe verwendet wird. So können in schneller Folge
 * mehrere Bursts (z. B. Sprinter-Trickle) angetriggert werden.
 */

import { useEffect, useRef } from 'react'

interface ConfettiBurstProps {
  /** Palette für die Partikelfarben (wird gleichmäßig verteilt). */
  colors: string[]
  /** Klein für Score-Feedback, groß für Winner-Announce. */
  intensity: 'small' | 'large'
  /** Callback nach vollständigem Ausblenden — Trigger sollte danach reset. */
  onDone: () => void
  /**
   * Beliebiger Wert, dessen Änderung einen neuen Burst startet. Bei gleichem
   * Token wird nicht neu gefeuert (Idempotenz gegen React-Rerender).
   */
  token: string | number
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  rotation: number
  rotationSpeed: number
  color: string
  size: number
  shape: 'rect' | 'circle'
  lifespan: number
  age: number
}

// Fallback-Palette, falls keine Team-Farben übergeben werden.
const DEFAULT_COLORS = ['#7C5CFF', '#27D8FF', '#FF6E5C', '#FF3D8B', '#FFD166']

export function ConfettiBurst({ colors, intensity, onDone, token }: ConfettiBurstProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    doneRef.current = false
    // Motion-Reduction: kein Rendering, direkt fertig melden.
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      const t = window.setTimeout(() => {
        if (!doneRef.current) {
          doneRef.current = true
          onDone()
        }
      }, 0)
      return () => window.clearTimeout(t)
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const width = window.innerWidth
    const height = window.innerHeight
    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`
    ctx.scale(dpr, dpr)

    const palette = colors.length > 0 ? colors : DEFAULT_COLORS
    const particles = createParticles(intensity, palette, width, height)
    const gravity = 0.18
    const drag = 0.992
    const maxDurationMs = intensity === 'small' ? 1600 : 3500
    const startedAt = performance.now()

    const tick = (t: number) => {
      const elapsed = t - startedAt
      ctx.clearRect(0, 0, width, height)

      for (const p of particles) {
        p.age += 16 // ~60 fps constant tick approx
        p.vy += gravity
        p.vx *= drag
        p.x += p.vx
        p.y += p.vy
        p.rotation += p.rotationSpeed

        // Fade in der letzten 30 % der Lebensdauer.
        const lifeRatio = p.age / p.lifespan
        const alpha = lifeRatio < 0.7 ? 1 : Math.max(0, 1 - (lifeRatio - 0.7) / 0.3)

        ctx.save()
        ctx.globalAlpha = alpha
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.fillStyle = p.color
        if (p.shape === 'rect') {
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, (p.size * 2) / 3)
        } else {
          ctx.beginPath()
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.restore()
      }

      if (elapsed < maxDurationMs) {
        rafRef.current = window.requestAnimationFrame(tick)
      } else {
        ctx.clearRect(0, 0, width, height)
        if (!doneRef.current) {
          doneRef.current = true
          onDone()
        }
      }
    }
    rafRef.current = window.requestAnimationFrame(tick)

    return () => {
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current)
      doneRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-50"
      aria-hidden
    />
  )
}

function createParticles(
  intensity: 'small' | 'large',
  palette: string[],
  width: number,
  height: number,
): Particle[] {
  const count = intensity === 'small' ? 26 : 90
  const lifespan = intensity === 'small' ? 1600 : 3500
  const particles: Particle[] = []

  for (let i = 0; i < count; i++) {
    let x: number
    let y: number
    let vx: number
    let vy: number
    if (intensity === 'small') {
      // Kleiner Burst: aus dem oberen Bildschirm-Zentrum nach unten-außen,
      // wirkt wie ein Popper-Blast über dem Content.
      x = width / 2 + (Math.random() - 0.5) * 60
      y = height * 0.22
      vx = (Math.random() - 0.5) * 9
      vy = -Math.random() * 5 - 2
    } else {
      // Großer Burst: aus den unteren Ecken nach oben-innen.
      const fromLeft = i % 2 === 0
      x = fromLeft ? width * 0.05 : width * 0.95
      y = height * 0.85
      vx = fromLeft ? Math.random() * 8 + 2 : -(Math.random() * 8 + 2)
      vy = -(Math.random() * 12 + 8)
    }
    particles.push({
      x,
      y,
      vx,
      vy,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 14,
      color: palette[i % palette.length],
      size: intensity === 'small' ? 7 + Math.random() * 5 : 9 + Math.random() * 7,
      shape: Math.random() > 0.35 ? 'rect' : 'circle',
      lifespan,
      age: 0,
    })
  }
  return particles
}

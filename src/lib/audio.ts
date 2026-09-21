/**
 * Prozedurale Sound-Effekte via Web-Audio-API.
 *
 * Alle Sounds werden aus Oscillator + Gain synthetisiert — kein Asset-Load,
 * kein Extra-Bundle. Vier Grund-Typen:
 *
 *  - `correct`  — zwei aufsteigende Sinus-Töne (C5 → G5), warmer Ping.
 *  - `wrong`    — zwei absteigende Triangle-Töne (E4 → C4), dumpfer Buzz.
 *  - `buzz`     — kurzer Sawtooth-Frequenz-Sweep (180 → 80 Hz), Buzzer-Klick.
 *  - `timeUp`   — vier absteigende Sawtooth-Töne, Talent-Show-Horn-Feel.
 *
 * Der `AudioContext` wird lazy beim ersten `play()` erzeugt und automatisch
 * per `resume()` aus dem Autoplay-Suspended-State geholt. Weil der erste
 * Play meist auf einen User-Klick folgt (JOIN_ROOM etc.), gilt der Kontext
 * dann als „user-activated" und Chrome/Safari lassen ihn laufen.
 *
 * `enabled` wird in `localStorage` unter `quizapp:sound-enabled` persistiert.
 * Default ist an; bei `prefers-reduced-motion: reduce` wird der Default auf
 * aus umgestellt (kann trotzdem manuell aktiviert werden).
 */

export type SoundType = 'correct' | 'wrong' | 'buzz' | 'timeUp'

const STORAGE_KEY = 'quizapp:sound-enabled'

class SoundManager {
  private ctx: AudioContext | null = null
  private enabled: boolean

  constructor() {
    this.enabled = this.readInitialEnabled()
  }

  private readInitialEnabled(): boolean {
    if (typeof window === 'undefined') return false
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored !== null) return stored === '1'
    } catch {
      /* localStorage kann in Privacy-Mode fehlen — ignore */
    }
    // Reduced-motion-Nutzer bekommen Sound-Feedback per Default aus.
    const prefersReduced =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    return !prefersReduced
  }

  isEnabled(): boolean {
    return this.enabled
  }

  setEnabled(next: boolean): void {
    this.enabled = next
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    } catch {
      /* ignore */
    }
    // Bei Aktivierung schon jetzt einen AudioContext bauen, damit der User-
    // Klick auf den Toggle als „user-activated" zählt — sonst würden Chrome/
    // Safari erst beim nächsten Klick den Kontext freischalten.
    if (next) this.ensureContext()
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null
    if (!this.ctx) {
      try {
        const Ctx: typeof AudioContext =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext!
        if (!Ctx) return null
        this.ctx = new Ctx()
      } catch {
        return null
      }
    }
    if (this.ctx.state === 'suspended') {
      // Rückgabe des Promise ignorieren — falls resume scheitert, bleibt
      // der Sound stumm, was ok ist.
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  play(type: SoundType): void {
    if (!this.enabled) return
    const ctx = this.ensureContext()
    if (!ctx) return
    const t0 = ctx.currentTime + 0.005 // kleiner Vorlauf gegen Klick-Artefakte
    switch (type) {
      case 'correct':
        playTone(ctx, 523.25, t0, 0.14, 'sine', 0.13) // C5
        playTone(ctx, 783.99, t0 + 0.08, 0.2, 'sine', 0.13) // G5
        break
      case 'wrong':
        playTone(ctx, 329.63, t0, 0.16, 'triangle', 0.12) // E4
        playTone(ctx, 261.63, t0 + 0.1, 0.22, 'triangle', 0.12) // C4
        break
      case 'buzz':
        playBuzz(ctx, t0)
        break
      case 'timeUp':
        playTone(ctx, 783.99, t0, 0.18, 'sawtooth', 0.11) // G5
        playTone(ctx, 659.25, t0 + 0.19, 0.18, 'sawtooth', 0.11) // E5
        playTone(ctx, 523.25, t0 + 0.38, 0.18, 'sawtooth', 0.11) // C5
        playTone(ctx, 392.0, t0 + 0.57, 0.32, 'sawtooth', 0.11) // G4
        break
    }
  }
}

/**
 * Sinus/Dreiecks/Sawtooth-Ton mit einfacher ADSR-Hülle. `peakGain` sollte
 * ≤ 0.2 bleiben, damit gleichzeitig laufende Töne nicht clippen.
 */
function playTone(
  ctx: AudioContext,
  freq: number,
  startAt: number,
  duration: number,
  waveform: OscillatorType,
  peakGain: number,
): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = waveform
  osc.frequency.setValueAtTime(freq, startAt)

  const attack = 0.012
  const release = 0.06
  const sustainEnd = startAt + Math.max(duration - release, attack)

  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(peakGain, startAt + attack)
  gain.gain.setValueAtTime(peakGain, sustainEnd)
  gain.gain.linearRampToValueAtTime(0, startAt + duration)

  osc.connect(gain).connect(ctx.destination)
  osc.start(startAt)
  osc.stop(startAt + duration + 0.02)
}

/**
 * Buzzer-Klick: Sawtooth-Sweep mit exponentiellem Gain-Decay. Klingt wie
 * ein kurzer „Bzzt", passt für Board/Duel-Buzz.
 */
function playBuzz(ctx: AudioContext, startAt: number): void {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(180, startAt)
  osc.frequency.exponentialRampToValueAtTime(80, startAt + 0.09)

  gain.gain.setValueAtTime(0, startAt)
  gain.gain.linearRampToValueAtTime(0.2, startAt + 0.008)
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.14)

  osc.connect(gain).connect(ctx.destination)
  osc.start(startAt)
  osc.stop(startAt + 0.16)
}

let instance: SoundManager | null = null

function getManager(): SoundManager {
  if (!instance) instance = new SoundManager()
  return instance
}

export function playSound(type: SoundType): void {
  getManager().play(type)
}

export function isSoundEnabled(): boolean {
  return getManager().isEnabled()
}

export function setSoundEnabled(next: boolean): void {
  getManager().setEnabled(next)
}

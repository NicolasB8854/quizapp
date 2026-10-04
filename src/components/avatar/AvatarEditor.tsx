/**
 * Avatar-Baukasten (Profilseite): Figur | Emoji | Initialen.
 *
 * Jede Bauteil-Option wird als Mini-Vorschau der EIGENEN Figur gezeigt
 * (nur das eine Teil getauscht) — so sieht man sofort, wie es wirkt.
 */
import { useState } from 'react'
import { Dices, Smile, Type, UserRound } from 'lucide-react'
import {
  AVATAR_PALETTES,
  AVATAR_PARTS,
  randomAvatarLook,
  type Avatar,
  type AvatarColorKey,
  type AvatarLook,
  type AvatarPartKey,
} from '@quizapp/shared'
import { cn } from '@/lib/classnames'
import { AvatarFigure, type AvatarCrop } from './AvatarFigure'

type Mode = 'figure' | 'emoji' | 'initials'

interface Tab {
  id: string
  label: string
  parts: [AvatarPartKey, string][]
  colors?: [AvatarColorKey, string][]
}

const TABS: Tab[] = [
  { id: 'face', label: 'Gesicht', parts: [['head', 'Kopfform'], ['nose', 'Nase'], ['cheeks', 'Wangen']], colors: [['skin', 'Hautton']] },
  { id: 'hair', label: 'Haare', parts: [['hair', 'Frisur']], colors: [['hairColor', 'Haarfarbe']] },
  { id: 'eyes', label: 'Augen', parts: [['eyes', 'Augen'], ['brows', 'Brauen']], colors: [['eyeColor', 'Augenfarbe']] },
  { id: 'mouth', label: 'Mund & Bart', parts: [['mouth', 'Mund'], ['beard', 'Bart']] },
  { id: 'style', label: 'Style', parts: [['glasses', 'Brille'], ['accessory', 'Extra']] },
  { id: 'outfit', label: 'Outfit', parts: [['outfit', 'Oberteil']], colors: [['outfitColor', 'Farbe']] },
]

/** Deutsche Namen für die Bauteil-IDs (Screenreader + Tooltip). */
const LABELS: Record<string, string> = {
  oval: 'Oval', round: 'Rund', square: 'Kantig', long: 'Schmal',
  short: 'Kurz', quiff: 'Tolle', spiky: 'Stachelig', buzz: 'Buzzcut', curly: 'Locken', afro: 'Afro',
  mohawk: 'Iro', bob: 'Bob', long_hair: 'Lang', ponytail: 'Zopf', bun: 'Dutt', locs: 'Locs', bald: 'Glatze',
  dots: 'Punkte', happy: 'Fröhlich', wink: 'Zwinkern', sleepy: 'Müde', wide: 'Groß',
  natural: 'Natürlich', raised: 'Hoch', angry: 'Grimmig', worried: 'Besorgt', thick: 'Buschig',
  soft: 'Weich', button: 'Stups', pointy: 'Spitz',
  smile: 'Lächeln', grin: 'Grinsen', laugh: 'Lachen', smirk: 'Schmunzeln', neutral: 'Neutral', oh: 'Oh!',
  none: 'Ohne', stubble: 'Dreitage', mustache: 'Schnauzer', goatee: 'Ziegenbart', full: 'Vollbart',
  shades: 'Sonnenbrille', visor: 'Visier',
  headphones: 'Kopfhörer', cap: 'Cap', beanie: 'Mütze', earrings: 'Ohrringe', partyhat: 'Partyhut',
  hoodie: 'Hoodie', tee: 'T-Shirt', blazer: 'Sakko', turtleneck: 'Rolli', jersey: 'Trikot',
  blush: 'Rouge', freckles: 'Sommersprossen',
}
const label = (key: AvatarPartKey, id: string) => LABELS[key === 'hair' && id === 'long' ? 'long_hair' : id] ?? id
const square = (key: AvatarPartKey, id: string) => (key === 'head' && id === 'square') || (key === 'glasses' && id === 'square')
const labelOf = (key: AvatarPartKey, id: string) => (square(key, id) ? (key === 'head' ? 'Kantig' : 'Eckig') : label(key, id))

/** Bust für alles, was über/unter das Gesicht ragt. */
const CROP: Partial<Record<AvatarPartKey, AvatarCrop>> = { hair: 'bust', accessory: 'bust', outfit: 'bust', beard: 'bust' }

interface Props {
  avatar: Avatar
  figure: AvatarLook | null
  emojis: readonly string[]
  /** Neuer Avatar + zuletzt gebaute Figur. */
  onChange: (avatar: Avatar, figure: AvatarLook | null) => void
}

export function AvatarEditor({ avatar, figure, emojis, onChange }: Props) {
  const mode: Mode = avatar.look ? 'figure' : avatar.emoji ? 'emoji' : 'initials'
  const [tab, setTab] = useState(TABS[0].id)
  const look = avatar.look ?? figure

  const setMode = (m: Mode) => {
    if (m === 'figure') {
      const next = look ?? randomAvatarLook()
      onChange({ ...avatar, look: next, emoji: null }, next)
    } else if (m === 'emoji') {
      onChange({ ...avatar, look: null, emoji: avatar.emoji ?? emojis[0] }, look)
    } else {
      onChange({ ...avatar, look: null, emoji: null }, look)
    }
  }
  const setLook = (next: AvatarLook) => onChange({ ...avatar, look: next, emoji: null }, next)
  const current = TABS.find((t) => t.id === tab) ?? TABS[0]

  return (
    <div className="space-y-3">
      <span className="text-xs uppercase tracking-[0.22em] text-ink-muted">Avatar</span>
      <div role="radiogroup" aria-label="Avatar-Art" className="grid grid-cols-3 gap-1 rounded-xl bg-white/[0.04] p-1">
        {([
          ['figure', 'Figur', <UserRound key="f" className="h-4 w-4" />],
          ['emoji', 'Emoji', <Smile key="e" className="h-4 w-4" />],
          ['initials', 'Initialen', <Type key="i" className="h-4 w-4" />],
        ] as const).map(([m, text, icon]) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              'inline-flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold transition-colors',
              mode === m ? 'bg-brand-purple text-white shadow-[0_0_18px_-6px_#7C5CFF]' : 'text-ink-muted hover:text-white',
            )}
          >
            {icon}
            {text}
          </button>
        ))}
      </div>

      {mode === 'emoji' && (
        <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-10">
          {emojis.map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={avatar.emoji === e}
              onClick={() => onChange({ ...avatar, emoji: e, look: null }, look)}
              className={cn(
                'flex h-10 items-center justify-center rounded-lg border text-xl',
                avatar.emoji === e ? 'border-brand-purple bg-brand-purple/20' : 'border-white/10 bg-white/[0.03]',
              )}
            >
              {e}
            </button>
          ))}
        </div>
      )}

      {mode === 'figure' && avatar.look && (
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div
              className="h-32 w-32 shrink-0 overflow-hidden rounded-full border-2"
              style={{ borderColor: `${avatar.colorHex}CC`, boxShadow: `0 0 32px -8px ${avatar.colorHex}` }}
            >
              <AvatarFigure look={avatar.look} accentHex={avatar.colorHex} className="h-full w-full" title="Vorschau deiner Figur" />
            </div>
            <button
              type="button"
              onClick={() => setLook(randomAvatarLook())}
              className="inline-flex h-11 items-center gap-2 rounded-xl border-2 border-brand-cyan/50 bg-brand-cyan/10 px-4 font-semibold text-brand-cyan-soft hover:bg-brand-cyan/20"
            >
              <Dices className="h-4 w-4" aria-hidden />
              Zufall
            </button>
          </div>

          <div role="tablist" aria-label="Bauteile" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors',
                  tab === t.id ? 'border-brand-purple bg-brand-purple/20 text-white' : 'border-white/10 text-ink-muted hover:text-white',
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div role="tabpanel" className="space-y-3">
            {current.colors?.map(([key, title]) => (
              <div key={key}>
                <div className="mb-1.5 text-xs text-ink-faint">{title}</div>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_PALETTES[key].map((hex, i) => (
                    <button
                      key={hex}
                      type="button"
                      aria-label={`${title} ${i + 1}`}
                      aria-pressed={avatar.look![key] === i}
                      onClick={() => setLook({ ...avatar.look!, [key]: i })}
                      className={cn(
                        'h-9 w-9 rounded-full border-2 transition-transform',
                        avatar.look![key] === i ? 'scale-110 border-white' : 'border-white/10',
                      )}
                      style={{ background: hex }}
                    />
                  ))}
                </div>
              </div>
            ))}
            {current.parts.map(([key, title]) => (
              <div key={key}>
                <div className="mb-1.5 text-xs text-ink-faint">{title}</div>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {(AVATAR_PARTS[key] as readonly string[]).map((id) => {
                    const active = avatar.look![key] === id
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={active}
                        aria-label={`${title}: ${labelOf(key, id)}`}
                        title={labelOf(key, id)}
                        onClick={() => setLook({ ...avatar.look!, [key]: id } as AvatarLook)}
                        className={cn(
                          'group flex flex-col items-center gap-1 rounded-xl border p-1.5 transition-colors',
                          active ? 'border-brand-purple bg-brand-purple/15' : 'border-white/10 bg-white/[0.03] hover:border-white/25',
                        )}
                      >
                        <span className="block aspect-square w-full overflow-hidden rounded-full">
                          <AvatarFigure
                            look={{ ...avatar.look!, [key]: id } as AvatarLook}
                            accentHex={avatar.colorHex}
                            crop={CROP[key] ?? 'face'}
                            className="h-full w-full"
                          />
                        </span>
                        <span className={cn('truncate text-[11px]', active ? 'text-white' : 'text-ink-muted')}>{labelOf(key, id)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

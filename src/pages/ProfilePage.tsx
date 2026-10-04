/**
 * Profil & Dashboard (#2, #22): eigener Avatar, Titel, Statistik dieses Geräts.
 * Alles in localStorage — bleibt über Sessions erhalten, wandert nicht zwischen Geräten.
 */
import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Camera, Crown, Flame, Trophy, X } from 'lucide-react'
import { AVATAR_COLORS, TOPICS_BY_ID, type Topic } from '@quizapp/shared'
import { ScreenLayout } from '@/components/ScreenLayout'
import { Button } from '@/components/Button'
import { Card } from '@/components/Card'
import { AvatarBadge } from '@/components/AvatarBadge'
import { AvatarEditor } from '@/components/avatar/AvatarEditor'
import { AVATAR_EMOJIS, readMyProfile, saveMyProfile, type MyProfile } from '@/lib/myProfile'
import { readSoloStats } from '@/lib/soloStats'
import { computeMetaTitles, computeTopicTitles, primaryTitle, TITLE_TIERS } from '@/lib/titles'
import { downscaleImageToDataUrl } from '@/lib/image'
import { cn } from '@/lib/classnames'

export default function ProfilePage() {
  const [profile, setProfile] = useState<MyProfile>(() => readMyProfile())
  const stats = useMemo(() => readSoloStats(), [])
  const topicTitles = useMemo(() => computeTopicTitles(stats), [stats])
  const metaTitles = useMemo(() => computeMetaTitles(stats), [stats])
  const title = primaryTitle(stats)
  const fileRef = useRef<HTMLInputElement>(null)

  const update = (patch: Partial<MyProfile> | ((p: MyProfile) => MyProfile)) => {
    setProfile((prev) => {
      const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }
      saveMyProfile(next)
      return next
    })
  }
  const setAvatar = (patch: Partial<MyProfile['avatar']>) =>
    update((p) => ({ ...p, avatar: { ...p.avatar, ...patch } }))

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setAvatar({ photoDataUrl: await downscaleImageToDataUrl(file) })
    } finally {
      e.target.value = ''
    }
  }

  const totalAnswered = Object.values(stats.perTopic).reduce((s, t) => s + (t?.answered ?? 0), 0)
  const totalCorrect = Object.values(stats.perTopic).reduce((s, t) => s + (t?.correct ?? 0), 0)
  const topicRows = (Object.entries(stats.perTopic) as [Topic, { answered: number; correct: number }][])
    .filter(([, t]) => t && t.answered > 0)
    .sort((a, b) => b[1].answered - a[1].answered)

  return (
    <ScreenLayout variant="dim" hideNav>
      <div className="mx-auto w-full max-w-xl space-y-4 px-4 py-4 md:py-8">
        <div className="flex items-center justify-between">
          <Link to="/">
            <Button variant="ghost" size="md" leading={<ArrowLeft className="h-4 w-4" />}>
              Start
            </Button>
          </Link>
          <div className="eyebrow">Mein Profil</div>
        </div>

        {/* Kopf */}
        <Card className="flex items-center gap-4 p-5">
          <AvatarBadge avatar={profile.avatar} size="xl" name={profile.name} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-2xl font-bold text-white">
              {profile.name.trim() || 'Namenlos'}
            </div>
            {title ? (
              <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-300/15 px-2.5 py-0.5 text-sm font-semibold text-amber-200">
                <Crown className="h-3.5 w-3.5" fill="currentColor" aria-hidden />
                {title}
              </div>
            ) : (
              <div className="mt-1 text-sm text-ink-muted">Noch kein Titel — spiel ein paar Runden.</div>
            )}
          </div>
        </Card>

        {/* Avatar-Editor */}
        <Card className="space-y-4 p-4">
          <label className="block">
            <span className="text-xs uppercase tracking-[0.22em] text-ink-muted">Name</span>
            <input
              value={profile.name}
              onChange={(e) => update({ name: e.target.value })}
              maxLength={40}
              placeholder="z. B. Sara"
              className="mt-1 w-full rounded-lg bg-white/10 px-4 py-3 text-lg text-white placeholder-white/30"
            />
          </label>

          <div>
            <span className="text-xs uppercase tracking-[0.22em] text-ink-muted">Deine Farbe</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {AVATAR_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Farbe ${c}`}
                  aria-pressed={profile.avatar.colorHex === c}
                  onClick={() => setAvatar({ colorHex: c })}
                  className={cn(
                    'h-9 w-9 rounded-full border-2 transition-transform',
                    profile.avatar.colorHex === c ? 'scale-110 border-white' : 'border-transparent',
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>

          <AvatarEditor
            avatar={profile.avatar}
            figure={profile.figure ?? null}
            emojis={AVATAR_EMOJIS}
            onChange={(avatar, figure) => update((p) => ({ ...p, avatar, figure }))}
          />

          <div className="flex flex-wrap items-center gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPhoto} />
            <Button variant="secondary" size="md" leading={<Camera className="h-4 w-4" />} onClick={() => fileRef.current?.click()}>
              {profile.avatar.photoDataUrl ? 'Foto ändern' : 'Foto wählen'}
            </Button>
            {profile.avatar.photoDataUrl && (
              <Button variant="ghost" size="md" leading={<X className="h-4 w-4" />} onClick={() => setAvatar({ photoDataUrl: null })}>
                Foto entfernen
              </Button>
            )}
            <span className="text-xs text-ink-faint">Im Spieleabend siehst du Figur bzw. Emoji in deiner Farbe, das Foto nur hier.</span>
          </div>
        </Card>

        {/* Kennzahlen */}
        <div className="grid grid-cols-3 gap-2">
          <Stat icon={<Flame className="h-4 w-4" />} label="Serie" value={`${stats.streakDays} T`} />
          <Stat icon={<Trophy className="h-4 w-4" />} label="Abende" value={`${stats.nightsWon}/${stats.nightsPlayed}`} />
          <Stat icon={<Crown className="h-4 w-4" />} label="Solo-Best" value={String(stats.bestScore)} />
        </div>
        <Card className="p-4 text-sm text-ink-muted">
          {totalAnswered > 0
            ? `${totalCorrect} von ${totalAnswered} Fragen richtig (${Math.round((totalCorrect / totalAnswered) * 100)} %) · ${stats.runs} Solo-Runden`
            : 'Noch keine Fragen beantwortet. Starte eine Solo-Runde oder einen Spieleabend.'}
        </Card>

        {/* Titel */}
        <Card className="space-y-3 p-4">
          <div className="text-xs uppercase tracking-[0.22em] text-ink-muted">Titel</div>
          {topicTitles.length === 0 && metaTitles.length === 0 && (
            <p className="text-sm text-ink-muted">
              Titel gibt es pro Thema: {TITLE_TIERS.map((t) => `${t.suffix} (${t.minAnswered}+ Fragen, ${Math.round(t.minRate * 100)} %)`).join(' · ')}.
            </p>
          )}
          {metaTitles.map((t) => (
            <div key={t.id} className="flex items-center justify-between text-sm">
              <span className="font-semibold text-amber-200">{t.label}</span>
              <span className="text-ink-muted">{t.description}</span>
            </div>
          ))}
          {topicTitles.map((t) => (
            <div key={t.topic} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-white">
                  {TOPICS_BY_ID[t.topic]?.emoji} {t.label}
                </span>
                <span className="text-ink-muted">{Math.round(t.rate * 100)} %</span>
              </div>
              {t.next && (
                <div className="text-xs text-ink-faint">
                  Nächste Stufe {t.next.tier.suffix}:
                  {t.next.answeredMissing > 0 ? ` noch ${t.next.answeredMissing} Fragen` : ''}
                  {t.next.rateMissing > 0 ? ` · Quote +${Math.ceil(t.next.rateMissing * 100)} %` : ''}
                </div>
              )}
            </div>
          ))}
        </Card>

        {/* Themen-Statistik */}
        {topicRows.length > 0 && (
          <Card className="space-y-2 p-4">
            <div className="text-xs uppercase tracking-[0.22em] text-ink-muted">Themen</div>
            {topicRows.map(([topic, t]) => {
              const rate = t.correct / t.answered
              return (
                <div key={topic} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/85">
                      {TOPICS_BY_ID[topic]?.emoji} {TOPICS_BY_ID[topic]?.label}
                    </span>
                    <span className="font-mono text-xs text-ink-muted">
                      {t.correct}/{t.answered}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={cn('h-full', rate >= 0.75 ? 'bg-correct' : rate >= 0.5 ? 'bg-brand-purple' : 'bg-wrong')}
                      style={{ width: `${Math.round(rate * 100)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </Card>
        )}
      </div>
    </ScreenLayout>
  )
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-xs uppercase tracking-[0.2em] text-ink-muted">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-mono text-lg font-bold text-white">{value}</div>
    </Card>
  )
}

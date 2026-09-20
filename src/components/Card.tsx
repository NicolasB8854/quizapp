/**
 * Card-Container — die Basis-Fläche für Panels und Module.
 *
 * PDF-Spec: „dunkle Fläche (#19223A), feine helle/akzentfarbene Border, Glow nur bei
 * Fokus oder Auswahl". Der `glow`-Prop ist bewusst optional, damit nicht alle Cards
 * gleichzeitig glühen (Guardrail: „Glow nur bei Fokus oder Auswahl").
 */

import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/classnames'

interface Props extends HTMLAttributes<HTMLDivElement> {
  glow?: 'purple' | 'cyan' | 'correct' | 'wrong' | null
  as?: 'div' | 'section' | 'article'
}

const glowMap: Record<NonNullable<Props['glow']> & string, string> = {
  purple: 'shadow-glow-purple border-brand-purple/40',
  cyan:   'shadow-glow-cyan border-brand-cyan/40',
  correct:'shadow-glow-correct border-correct/40',
  wrong:  'shadow-glow-wrong border-wrong/40',
}

export function Card({ className, glow = null, as: As = 'div', ...rest }: Props) {
  return (
    <As
      className={cn(
        'rounded-card bg-navy-700 border border-white/[0.06] shadow-card bg-panel',
        glow && glowMap[glow],
        className,
      )}
      {...rest}
    />
  )
}

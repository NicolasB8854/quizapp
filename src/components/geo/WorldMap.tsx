/**
 * WorldMap — interaktive Weltkarte für „Wo liegt das?".
 *
 * Plattkartische Karte (`/img/geo/world.svg`, siehe scripts/build-world-map.py),
 * darüber Nadeln, Ziel und Entfernungslinien als SVG im selben Koordinatensystem.
 * Gesten: Ziehen = verschieben, zwei Finger / Mausrad / +− = zoomen,
 * kurzer Tipp = Nadel setzen (nur wenn `onPick` gesetzt ist).
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Minus, Plus, Maximize2 } from 'lucide-react'
import { MAP_HEIGHT, MAP_WIDTH, fromMap, toMap, type LatLon } from '@quizapp/shared'
import { cn } from '@/lib/classnames'

export interface MapPin extends LatLon {
  id: string
  color: string
  label?: string
  /** Eigene Nadel (größer, pulsierend). */
  mine?: boolean
}

interface Props {
  pins: MapPin[]
  /** Ziel (nach der Auflösung). */
  target?: (LatLon & { name: string }) | null
  /** Entfernungslabels pro Nadel-ID (nach der Auflösung). */
  distances?: Record<string, string>
  onPick?: (p: LatLon) => void
  /** Seitenverhältnis Breite/Höhe. */
  aspect?: number
  className?: string
}

interface ViewBox {
  x: number
  y: number
  w: number
}

const MIN_W = 40
const GRID = [-150, -120, -90, -60, -30, 0, 30, 60, 90, 120, 150]

function clampVb(vb: ViewBox, aspect: number): ViewBox {
  const w = Math.min(MAP_WIDTH, Math.max(MIN_W, vb.w))
  const h = w / aspect
  const x = Math.min(MAP_WIDTH - w, Math.max(0, vb.x))
  const y = h >= MAP_HEIGHT ? (MAP_HEIGHT - h) / 2 : Math.min(MAP_HEIGHT - h, Math.max(0, vb.y))
  return { x, y, w }
}

function initialVb(aspect: number): ViewBox {
  // Ganze Höhe zeigen, horizontal auf Europa/Afrika zentriert.
  const w = Math.min(MAP_WIDTH, MAP_HEIGHT * aspect)
  const cx = toMap({ lat: 0, lon: 15 }).x
  return clampVb({ x: cx - w / 2, y: 0, w }, aspect)
}

function fitVb(points: LatLon[], aspect: number): ViewBox {
  const xy = points.map(toMap)
  const minX = Math.min(...xy.map((p) => p.x))
  const maxX = Math.max(...xy.map((p) => p.x))
  const minY = Math.min(...xy.map((p) => p.y))
  const maxY = Math.max(...xy.map((p) => p.y))
  const pad = 70
  const w = Math.max(120, maxX - minX + 2 * pad, (maxY - minY + 2 * pad) * aspect)
  return clampVb({ x: (minX + maxX) / 2 - w / 2, y: (minY + maxY) / 2 - w / aspect / 2, w }, aspect)
}

/** km-Label neben die Nadel, auf die vom Ziel abgewandte Seite (überdeckt so nie den Stern). */
function labelPos(m: { x: number; y: number }, t: { x: number; y: number } | null, r: number, k: number) {
  const dx = t ? m.x - t.x : 0
  const dy = t ? m.y - t.y : -1
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len
  const off = r + 10 * k
  const textAnchor: 'start' | 'end' | 'middle' = Math.abs(ux) < 0.35 ? 'middle' : ux > 0 ? 'start' : 'end'
  return { x: m.x + ux * off, y: m.y + uy * off + (uy > 0.35 ? 10 * k : uy < -0.35 ? 0 : 4 * k), textAnchor }
}

export function WorldMap({ pins, target, distances, onPick, aspect = 4 / 3, className }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [vb, setVb] = useState<ViewBox>(() => (target ? fitVb([target, ...pins], aspect) : initialVb(aspect)))
  const [pxWidth, setPxWidth] = useState(400)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const gesture = useRef<{ startX: number; startY: number; t: number; moved: boolean; pinchDist?: number; vb: ViewBox } | null>(null)

  useLayoutEffect(() => {
    const el = svgRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setPxWidth(el.clientWidth || 400))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Bei der Auflösung auf Ziel + Nadeln zoomen.
  const targetKey = target ? `${target.lat},${target.lon}` : ''
  useEffect(() => {
    if (!target) return
    setVb(fitVb([target, ...pins], aspect))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey, aspect])

  const k = vb.w / Math.max(1, pxWidth) // SVG-Einheiten pro Bildschirmpixel
  const h = vb.w / aspect

  const toSvg = useCallback((clientX: number, clientY: number) => {
    const el = svgRef.current
    const ctm = el?.getScreenCTM()
    if (!el || !ctm) return null
    const pt = el.createSVGPoint()
    pt.x = clientX
    pt.y = clientY
    return pt.matrixTransform(ctm.inverse())
  }, [])

  const zoomAt = (factor: number, cx: number, cy: number, base: ViewBox = vb) => {
    const w = Math.min(MAP_WIDTH, Math.max(MIN_W, base.w * factor))
    const f = w / base.w
    setVb(clampVb({ x: cx - (cx - base.x) * f, y: cy - (cy - base.y) * f, w }, aspect))
  }

  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pts = [...pointers.current.values()]
    gesture.current = {
      startX: e.clientX,
      startY: e.clientY,
      t: Date.now(),
      moved: pts.length > 1,
      pinchDist: pts.length === 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : undefined,
      vb,
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gesture.current
    const pts = [...pointers.current.values()]
    if (pts.length === 2 && g.pinchDist) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      const mid = toSvg((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2)
      if (mid) zoomAt(g.pinchDist / d, mid.x, mid.y, g.vb)
      g.moved = true
      return
    }
    const dx = e.clientX - g.startX
    const dy = e.clientY - g.startY
    if (Math.hypot(dx, dy) > 6) g.moved = true
    if (g.moved) {
      const scale = g.vb.w / Math.max(1, pxWidth)
      setVb(clampVb({ x: g.vb.x - dx * scale, y: g.vb.y - dy * scale, w: g.vb.w }, aspect))
    }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current
    pointers.current.delete(e.pointerId)
    if (pointers.current.size > 0) {
      // Nach Pinch mit einem Finger weiterziehen können.
      const [p] = [...pointers.current.values()]
      gesture.current = { startX: p.x, startY: p.y, t: Date.now(), moved: true, vb }
      return
    }
    gesture.current = null
    if (!g || g.moved || Date.now() - g.t > 600 || !onPick) return
    const pt = toSvg(e.clientX, e.clientY)
    if (!pt || pt.y < 0 || pt.y > MAP_HEIGHT) return
    onPick(fromMap(pt.x, pt.y))
  }

  const onWheel = (e: React.WheelEvent) => {
    const pt = toSvg(e.clientX, e.clientY)
    if (pt) zoomAt(e.deltaY > 0 ? 1.15 : 1 / 1.15, pt.x, pt.y)
  }

  const btn = 'flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-navy-900/85 text-white backdrop-blur hover:bg-navy-700'
  const t = target ? toMap(target) : null

  return (
    <div className={cn('relative overflow-hidden rounded-card border-2 border-correct/40 bg-[#081021] shadow-[0_0_32px_-10px_rgba(63,217,139,0.6)]', className)}>
      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${h}`}
        className={cn('block w-full select-none', onPick ? 'cursor-crosshair' : 'cursor-grab')}
        style={{ aspectRatio: String(aspect), touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        role="img"
        aria-label={onPick ? 'Weltkarte – tippe, um deine Nadel zu setzen' : 'Weltkarte'}
      >
        <rect x={-MAP_WIDTH} y={-MAP_HEIGHT} width={MAP_WIDTH * 3} height={MAP_HEIGHT * 3} fill="#081021" />
        <g stroke="#27D8FF" strokeOpacity={0.08} strokeWidth={k}>
          {GRID.map((lon) => {
            const x = toMap({ lat: 0, lon }).x
            return <line key={`v${lon}`} x1={x} x2={x} y1={0} y2={MAP_HEIGHT} />
          })}
          {[60, 30, 0, -30].map((lat) => {
            const y = toMap({ lat, lon: 0 }).y
            return <line key={`h${lat}`} x1={0} x2={MAP_WIDTH} y1={y} y2={y} strokeOpacity={lat === 0 ? 0.18 : 0.08} />
          })}
        </g>
        <image href="/img/geo/world.svg" x={0} y={0} width={MAP_WIDTH} height={MAP_HEIGHT} preserveAspectRatio="none" />

        {t &&
          pins.map((p) => {
            const m = toMap(p)
            return (
              <line key={`l-${p.id}`} x1={m.x} y1={m.y} x2={t.x} y2={t.y} stroke={p.color} strokeWidth={2.2 * k} strokeDasharray={`${6 * k} ${4 * k}`} strokeLinecap="round" />
            )
          })}

        {pins.map((p) => {
          const m = toMap(p)
          const r = (p.mine ? 9 : 7) * k
          return (
            <g key={p.id}>
              {p.mine && !t && (
                <circle cx={m.x} cy={m.y} r={r * 2.2} fill={p.color} opacity={0.25}>
                  <animate attributeName="r" values={`${r};${r * 2.6};${r}`} dur="1.6s" repeatCount="indefinite" />
                </circle>
              )}
              <circle cx={m.x} cy={m.y} r={r} fill={p.color} stroke="#ffffff" strokeWidth={2 * k} />
              {distances?.[p.id] && (
                <text {...labelPos(m, t, r, k)} fontSize={13 * k} fontWeight={700} fill="#ffffff" stroke="#0B1020" strokeWidth={3 * k} paintOrder="stroke" fontFamily="Inter, sans-serif">
                  {distances[p.id]}
                </text>
              )}
            </g>
          )
        })}

        {t && target && (
          <g>
            <circle cx={t.x} cy={t.y} r={16 * k} fill="#FFE066" opacity={0.25}>
              <animate attributeName="r" values={`${10 * k};${22 * k};${10 * k}`} dur="1.4s" repeatCount="indefinite" />
            </circle>
            <path
              d={`M${t.x} ${t.y - 11 * k} L${t.x + 3.2 * k} ${t.y - 3.4 * k} L${t.x + 11 * k} ${t.y - 3.4 * k} L${t.x + 4.8 * k} ${t.y + 1.8 * k} L${t.x + 7 * k} ${t.y + 10 * k} L${t.x} ${t.y + 5 * k} L${t.x - 7 * k} ${t.y + 10 * k} L${t.x - 4.8 * k} ${t.y + 1.8 * k} L${t.x - 11 * k} ${t.y - 3.4 * k} L${t.x - 3.2 * k} ${t.y - 3.4 * k} Z`}
              fill="#FFE066"
              stroke="#0B1020"
              strokeWidth={1.5 * k}
            />
            <text x={t.x} y={t.y - 18 * k} textAnchor="middle" fontSize={15 * k} fontWeight={800} fill="#FFE066" stroke="#0B1020" strokeWidth={3.5 * k} paintOrder="stroke" fontFamily="Montserrat, Inter, sans-serif">
              {target.name}
            </text>
          </g>
        )}
      </svg>

      <div className="absolute right-2 top-2 flex flex-col gap-1.5">
        <button type="button" aria-label="Hineinzoomen" className={btn} onClick={() => zoomAt(1 / 1.6, vb.x + vb.w / 2, vb.y + h / 2)}>
          <Plus className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Herauszoomen" className={btn} onClick={() => zoomAt(1.6, vb.x + vb.w / 2, vb.y + h / 2)}>
          <Minus className="h-4 w-4" />
        </button>
        <button type="button" aria-label="Ganze Karte" className={btn} onClick={() => setVb(initialVb(aspect))}>
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

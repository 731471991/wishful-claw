import { useCallback, useRef } from 'react'
import { cn } from '@renderer/lib/utils'
import type { ReasoningEffortLevel } from '@renderer/lib/api/types'

interface ReasoningEffortSliderProps {
  levels: ReasoningEffortLevel[]
  value: ReasoningEffortLevel
  onChange: (level: ReasoningEffortLevel) => void
  /** Dim the control (e.g. thinking is off) while keeping it interactive. */
  dimmed?: boolean
  fasterLabel: string
  smarterLabel: string
  /** Accessible name for the slider; falls back to the endpoint labels. */
  ariaLabel?: string
}

const clamp01 = (n: number): number => (n < 0 ? 0 : n > 1 ? 1 : n)

const REASONING_EFFORT_CSS = `
.reasoningEffortFill {
  background: linear-gradient(90deg, #a79aff 0%, #bb8cff 54%, #d574ff 100%);
  box-shadow: 0 0 12px rgba(190, 139, 255, 0.38);
}
.reasoningEffortFillMax {
  background: linear-gradient(90deg, #a79aff 0%, #bb8cff 40%, #de7cff 74%, #fff7ff 100%);
  box-shadow:
    0 0 14px rgba(216, 180, 254, 0.58),
    0 0 24px rgba(232, 121, 249, 0.28);
  animation: reasoningEffortMaxBreath 1.65s ease-in-out infinite;
}
.reasoningEffortFill::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.58) 45%, transparent 78%);
  opacity: 0.34;
  transform: translateX(-85%);
  animation: reasoningEffortSheen 2.4s ease-in-out infinite;
}
.reasoningEffortThumb {
  background: linear-gradient(180deg, #515765 0%, #363b46 100%);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.18),
    0 4px 10px rgba(7, 10, 18, 0.42),
    0 0 12px rgba(183, 145, 255, 0.24);
}
.dark .reasoningEffortThumb {
  background: linear-gradient(180deg, #4d5361 0%, #303541 100%);
}
.reasoningEffortRailMax {
  background:
    radial-gradient(circle at 100% 50%, rgba(255, 255, 255, 0.34) 0%, rgba(232, 121, 249, 0.22) 24%, transparent 48%),
    linear-gradient(90deg, rgba(76, 29, 149, 0.22) 0%, rgba(126, 34, 206, 0.3) 58%, rgba(192, 38, 211, 0.44) 100%);
  box-shadow:
    inset 0 0 0 1px rgba(216, 180, 254, 0.38),
    0 0 16px rgba(168, 85, 247, 0.3),
    0 0 28px rgba(217, 70, 239, 0.18);
}
.reasoningEffortRailMax::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 4;
  pointer-events: none;
  background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.42) 42%, rgba(244, 214, 255, 0.72) 52%, transparent 70%);
  mix-blend-mode: screen;
  opacity: 0.7;
  transform: translateX(-112%);
  animation: reasoningEffortMaxSweep 1.35s ease-in-out infinite;
}
.reasoningEffortRailMax::after {
  content: '';
  position: absolute;
  top: 50%;
  right: 0;
  z-index: 3;
  width: 34%;
  height: 18px;
  pointer-events: none;
  background: radial-gradient(ellipse at right, rgba(255, 255, 255, 0.58) 0%, rgba(232, 121, 249, 0.28) 42%, transparent 74%);
  opacity: 0.88;
  transform: translateY(-50%);
}
.reasoningEffortThumbMax {
  background: radial-gradient(circle at 42% 35%, #ffffff 0%, #fce7ff 22%, #d8b4fe 42%, #8b5cf6 70%, #4c1d95 100%);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.38),
    0 2px 7px rgba(7, 10, 18, 0.38),
    0 0 0 2px rgba(196, 181, 253, 0.24),
    0 0 15px rgba(244, 214, 255, 0.78),
    0 0 28px rgba(232, 121, 249, 0.46);
}
.reasoningEffortMaxLabel {
  border-color: rgba(216, 180, 254, 0.64);
  background: linear-gradient(180deg, rgba(49, 44, 60, 0.98), rgba(33, 31, 38, 0.98));
  color: rgb(250, 245, 255);
  box-shadow:
    0 7px 18px rgba(16, 12, 26, 0.24),
    0 0 18px rgba(192, 132, 252, 0.28);
}
.reasoningEffortMaxChip {
  background: linear-gradient(90deg, #f5d0fe 0%, #ddd6fe 100%);
  color: #271334;
  box-shadow: 0 0 12px rgba(244, 214, 255, 0.46);
  animation: reasoningEffortMaxChip 1.4s ease-in-out infinite;
}
.reasoningEffortMaxSpark {
  position: absolute;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 6px rgba(244, 214, 255, 0.75);
  opacity: 0;
  animation: reasoningEffortSpark var(--dur) ease-in-out var(--delay) infinite;
}
.reasoningEffortMaxScatter {
  position: absolute;
  border-radius: 9999px;
  background: rgba(255, 247, 255, 0.92);
  box-shadow: 0 0 5px rgba(232, 121, 249, 0.7);
  opacity: 0;
  animation: reasoningEffortScatter var(--dur) ease-out var(--delay) infinite;
}
@keyframes reasoningEffortSheen {
  0%, 42% { transform: translateX(-85%); }
  78%, 100% { transform: translateX(110%); }
}
@keyframes reasoningEffortMaxSweep {
  0%, 18% { transform: translateX(-112%); }
  72%, 100% { transform: translateX(112%); }
}
@keyframes reasoningEffortMaxBreath {
  0%, 100% { filter: saturate(1) brightness(1); }
  50% { filter: saturate(1.28) brightness(1.14); }
}
@keyframes reasoningEffortMaxChip {
  0%, 100% { transform: scale(1); opacity: 0.82; }
  50% { transform: scale(1.06); opacity: 1; }
}
@keyframes reasoningEffortSpark {
  0%, 100% { transform: translateY(0) scale(0.55); opacity: 0; }
  42% { transform: translateY(1px) scale(1); opacity: 0.95; }
}
@keyframes reasoningEffortScatter {
  0% { transform: translate(0, 0) scale(0.4); opacity: 0; }
  16% { opacity: 0.95; }
  70% { opacity: 0.5; }
  100% { transform: translate(var(--tx), var(--ty)) scale(0.15); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .reasoningEffortFill::after { animation: none; opacity: 0; }
  .reasoningEffortFillMax,
  .reasoningEffortRailMax::before,
  .reasoningEffortMaxChip,
  .reasoningEffortMaxSpark,
  .reasoningEffortMaxScatter {
    animation: none;
  }
  .reasoningEffortRailMax::before { opacity: 0.35; transform: none; }
  .reasoningEffortMaxSpark { opacity: 0.7; }
  .reasoningEffortMaxScatter { opacity: 0; }
}
`.trim()

interface MaxSpark {
  x: number
  y: number
  size: number
  dur: number
  delay: number
}

interface ScatterDot {
  /** Emission point along the rail, in %. */
  x: number
  edge: 'top' | 'bottom'
  /** Drift distance away from the rail, in px. */
  tx: number
  ty: number
  size: number
  dur: number
  delay: number
}

// Dots disperse outward from the whole rail; denser and farther near the max end.
const MAX_SCATTER: ScatterDot[] = [
  { x: 8, edge: 'top', tx: -3, ty: -9, size: 1.6, dur: 2.6, delay: 0.2 },
  { x: 16, edge: 'bottom', tx: 2, ty: 7, size: 1.4, dur: 2.9, delay: 1.1 },
  { x: 27, edge: 'top', tx: 4, ty: -11, size: 1.8, dur: 2.4, delay: 0.6 },
  { x: 38, edge: 'bottom', tx: -2, ty: 8, size: 1.5, dur: 2.7, delay: 1.7 },
  { x: 47, edge: 'top', tx: 3, ty: -10, size: 1.7, dur: 2.2, delay: 0.05 },
  { x: 58, edge: 'bottom', tx: 4, ty: 7, size: 1.6, dur: 2.5, delay: 0.9 },
  { x: 66, edge: 'top', tx: -4, ty: -12, size: 1.9, dur: 2.1, delay: 1.35 },
  { x: 74, edge: 'top', tx: 5, ty: -9, size: 1.6, dur: 1.9, delay: 0.45 },
  { x: 81, edge: 'bottom', tx: 5, ty: 8, size: 1.8, dur: 2.2, delay: 1.55 },
  { x: 87, edge: 'top', tx: 6, ty: -13, size: 2, dur: 1.8, delay: 0.75 },
  { x: 93, edge: 'top', tx: 8, ty: -10, size: 2.1, dur: 1.7, delay: 0.15 },
  { x: 97, edge: 'bottom', tx: 9, ty: 6, size: 1.9, dur: 1.9, delay: 1 },
  { x: 100, edge: 'top', tx: 11, ty: -7, size: 2.2, dur: 1.6, delay: 0.55 },
  { x: 100, edge: 'bottom', tx: 12, ty: 9, size: 1.7, dur: 1.8, delay: 1.25 }
]

const MAX_SPARKS: MaxSpark[] = [
  { x: 55, y: 4, size: 1.2, dur: 1.9, delay: 0.15 },
  { x: 60, y: 8, size: 1.4, dur: 2.1, delay: 0.85 },
  { x: 66, y: 3, size: 1.3, dur: 1.8, delay: 1.15 },
  { x: 71, y: 9, size: 1.6, dur: 2, delay: 0.45 },
  { x: 76, y: 5, size: 1.7, dur: 1.65, delay: 1.3 },
  { x: 81, y: 8, size: 1.4, dur: 1.85, delay: 0.7 },
  { x: 85, y: 3, size: 1.7, dur: 1.7, delay: 0.05 },
  { x: 89, y: 7, size: 1.8, dur: 1.4, delay: 0 },
  { x: 92, y: 8, size: 2.3, dur: 1.7, delay: 0.35 },
  { x: 95, y: 7, size: 1.8, dur: 1.5, delay: 0.7 },
  { x: 97, y: 9, size: 2, dur: 1.8, delay: 1.05 }
]

function formatEffortLabel(level: ReasoningEffortLevel): string {
  const label = String(level).toLowerCase() === 'xhigh' ? 'extra high' : String(level)
  return label
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function ReasoningEffortSlider(props: ReasoningEffortSliderProps): React.JSX.Element {
  const { levels, value, onChange, dimmed = false, fasterLabel, smarterLabel, ariaLabel } = props

  const railRef = useRef<HTMLDivElement | null>(null)
  const draggingRef = useRef(false)

  const lastIndex = Math.max(0, levels.length - 1)
  const index = Math.max(0, levels.indexOf(value))
  const isMax = lastIndex > 0 && index === lastIndex
  const showMaxEasterEgg = isMax && !dimmed
  const pct = lastIndex > 0 ? (index / lastIndex) * 100 : 0
  const valueLabel = formatEffortLabel(value)
  const valueTransform =
    index <= 0 ? 'translateX(0)' : index >= lastIndex ? 'translateX(-100%)' : 'translateX(-50%)'

  const commit = useCallback(
    (next: number): void => {
      const clamped = next < 0 ? 0 : next > lastIndex ? lastIndex : next
      const level = levels[clamped]
      if (level && level !== value) onChange(level)
    },
    [lastIndex, levels, value, onChange]
  )

  const commitFromClientX = useCallback(
    (clientX: number): void => {
      const rail = railRef.current
      if (!rail) return
      const rect = rail.getBoundingClientRect()
      if (rect.width <= 0) return
      const ratio = clamp01((clientX - rect.left) / rect.width)
      commit(Math.round(ratio * lastIndex))
    },
    [commit, lastIndex]
  )

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    e.preventDefault()
    // preventDefault suppresses native focus, so restore it for keyboard follow-up.
    e.currentTarget.focus()
    draggingRef.current = true
    e.currentTarget.setPointerCapture(e.pointerId)
    commitFromClientX(e.clientX)
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) return
    commitFromClientX(e.clientX)
  }

  const endDrag = (e: React.PointerEvent<HTMLDivElement>): void => {
    draggingRef.current = false
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        e.preventDefault()
        commit(index + 1)
        break
      case 'ArrowLeft':
      case 'ArrowDown':
        e.preventDefault()
        commit(index - 1)
        break
      case 'Home':
        e.preventDefault()
        commit(0)
        break
      case 'End':
        e.preventDefault()
        commit(lastIndex)
        break
      default:
        break
    }
  }

  return (
    <div className={cn('flex w-full select-none flex-col', dimmed && 'opacity-60')}>
      <style>{REASONING_EFFORT_CSS}</style>

      <div
        role="slider"
        tabIndex={0}
        aria-label={ariaLabel ?? `${fasterLabel} – ${smarterLabel}`}
        aria-valuemin={0}
        aria-valuemax={lastIndex}
        aria-valuenow={index}
        aria-valuetext={String(value).toUpperCase()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className={cn(
          'group relative h-[60px] cursor-pointer touch-none rounded-xl px-2 outline-none transition-colors',
          'focus-visible:ring-2 focus-visible:ring-violet-500/50',
          showMaxEasterEgg &&
            'bg-violet-500/[0.055] shadow-[inset_0_0_0_1px_rgba(216,180,254,0.14),0_0_22px_rgba(168,85,247,0.12)]'
        )}
      >
        {/* Shared inset keeps the value pill, thumb and endpoint labels on the same rail. */}
        <div className="absolute inset-x-[14px] inset-y-0">
          <div className="absolute inset-x-0 top-1 flex items-center justify-between text-[10px] font-medium leading-none text-muted-foreground/75">
            <span>{fasterLabel}</span>
            <span>{smarterLabel}</span>
          </div>

          <span
            aria-hidden
            className={cn(
              'absolute top-[18px] z-30 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none shadow-sm backdrop-blur',
              'border-border/70 bg-popover/95 text-foreground/85',
              'transition-[left,transform,background-color,border-color,color] duration-150 ease-out motion-reduce:transition-none',
              'group-hover:border-violet-300/60 group-hover:text-violet-700 dark:group-hover:text-violet-200',
              showMaxEasterEgg && 'reasoningEffortMaxLabel'
            )}
            style={{ left: `${pct}%`, transform: valueTransform }}
          >
            <span>{valueLabel}</span>
            {showMaxEasterEgg && (
              <span className="reasoningEffortMaxChip inline-flex rounded-full px-1 py-px text-[8px] font-black tracking-wide">
                MAX
              </span>
            )}
          </span>

          {/* Scatter layer sits outside the rail so dots can escape its overflow clip. */}
          {showMaxEasterEgg && (
            <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-2 z-[5] h-3">
              {MAX_SCATTER.map((dot, i) => (
                <span
                  key={i}
                  className="reasoningEffortMaxScatter"
                  style={
                    {
                      left: `${dot.x}%`,
                      top: dot.edge === 'top' ? -1 : undefined,
                      bottom: dot.edge === 'bottom' ? -1 : undefined,
                      width: dot.size,
                      height: dot.size,
                      '--tx': `${dot.tx}px`,
                      '--ty': `${dot.ty}px`,
                      '--dur': `${dot.dur}s`,
                      '--delay': `${dot.delay}s`
                    } as React.CSSProperties
                  }
                />
              ))}
            </div>
          )}

          <div
            ref={railRef}
            className={cn(
              'absolute inset-x-0 bottom-2 h-3 overflow-hidden rounded-full',
              'bg-slate-950/10 shadow-inner shadow-black/10 transition-shadow dark:bg-black/20',
              showMaxEasterEgg && 'reasoningEffortRailMax'
            )}
          >
            <div
              aria-hidden
              className={cn(
                'reasoningEffortFill absolute inset-y-0 left-0 z-[1] overflow-hidden rounded-full',
                'transition-[width,opacity] duration-150 ease-out motion-reduce:transition-none',
                showMaxEasterEgg && 'reasoningEffortFillMax'
              )}
              style={{ width: `${pct}%`, opacity: dimmed ? 0.58 : 1 }}
            />

            {showMaxEasterEgg &&
              MAX_SPARKS.map((spark, i) => (
                <span
                  key={i}
                  aria-hidden
                  className="reasoningEffortMaxSpark z-[8]"
                  style={
                    {
                      left: `${spark.x}%`,
                      top: spark.y,
                      width: spark.size,
                      height: spark.size,
                      '--dur': `${spark.dur}s`,
                      '--delay': `${spark.delay}s`
                    } as React.CSSProperties
                  }
                />
              ))}

            {levels.map((lvl, i) => {
              const tickPct = lastIndex > 0 ? (i / lastIndex) * 100 : 0
              return (
                <span
                  key={`${lvl}-${i}`}
                  aria-hidden
                  className={cn(
                    'absolute top-1/2 z-10 size-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors',
                    showMaxEasterEgg && i === lastIndex
                      ? 'opacity-0'
                      : i <= index
                        ? 'bg-white/70 shadow-sm'
                        : 'bg-muted-foreground/45'
                  )}
                  style={{ left: `${tickPct}%` }}
                />
              )
            })}

            <span
              aria-hidden
              className={cn(
                'reasoningEffortThumb absolute z-20',
                'transition-[left,box-shadow,transform] duration-150 ease-out motion-reduce:transition-none',
                'group-active:scale-105',
                showMaxEasterEgg
                  ? 'reasoningEffortThumbMax top-1/2 size-3 -translate-x-full -translate-y-1/2 rounded-full'
                  : 'top-[calc(50%+1px)] h-[18px] w-3 -translate-x-1/2 -translate-y-1/2 rounded-[5px]'
              )}
              style={{ left: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

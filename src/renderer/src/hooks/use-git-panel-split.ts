import * as React from 'react'

export interface GitPanelSplitState {
  splitRatio: number
  setSplitRatio: (ratio: number) => void
  scmWidth?: number
  historyWidth?: number
  containerRef?: React.RefObject<HTMLDivElement>
  onScmResizePointerDown?: (e: React.PointerEvent) => void
  onHistoryResizePointerDown?: (e: React.PointerEvent) => void
}

export function useGitPanelSplit() {
  const [splitRatio, setSplitRatio] = React.useState(0.5)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [scmWidth, setScmWidth] = React.useState(360)
  const [historyWidth, setHistoryWidth] = React.useState(300)

  const onScmResizePointerDown = React.useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = scmWidth
    const onMove = (ev: PointerEvent) => {
      setScmWidth(Math.max(200, startWidth + ev.clientX - startX))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [scmWidth])

  const onHistoryResizePointerDown = React.useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = historyWidth
    const onMove = (ev: PointerEvent) => {
      setHistoryWidth(Math.max(200, startWidth - (ev.clientX - startX)))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [historyWidth])

  return {
    splitRatio,
    setSplitRatio,
    scmWidth,
    historyWidth,
    containerRef,
    onScmResizePointerDown,
    onHistoryResizePointerDown,
  }
}

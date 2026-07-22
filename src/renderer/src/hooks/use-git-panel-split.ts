import { useState } from 'react'

export function useGitPanelSplit() {
  const [splitRatio, setSplitRatio] = useState(0.5)
  return { splitRatio, setSplitRatio }
}

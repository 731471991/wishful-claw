import { useEffect, useState } from 'react'

export function applyMermaidTheme(_isDark: boolean): void {}

export async function copyMermaidToClipboard(_code: string): Promise<void> {}

export function useMermaidThemeVersion(): number {
  const [version, setVersion] = useState(0)
  useEffect(() => {
    setVersion((v) => v + 1)
  }, [])
  return version
}

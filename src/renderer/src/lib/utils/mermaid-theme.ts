import { useEffect, useState } from 'react'

export interface MermaidRenderResult {
  svg: string
}

export interface MermaidRenderer {
  render(id: string, source: string): Promise<MermaidRenderResult>
}

export async function applyMermaidTheme(_isDark?: boolean): Promise<MermaidRenderer> {
  return {
    async render(_id: string, _source: string): Promise<MermaidRenderResult> {
      return { svg: '' }
    }
  }
}

export async function copyMermaidToClipboard(_code: string): Promise<void> {}

export function useMermaidThemeVersion(): number {
  const [version, setVersion] = useState(0)
  useEffect(() => {
    setVersion((v) => v + 1)
  }, [])
  return version
}

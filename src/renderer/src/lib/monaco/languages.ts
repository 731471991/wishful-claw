export function guessLanguage(filePath: string): string {
  const normalized = filePath.trim()
  const fileName = normalized.split(/[\\/]/).pop()?.toLowerCase() ?? ''
  const ext =
    normalized.lastIndexOf('.') >= 0
      ? normalized.slice(normalized.lastIndexOf('.') + 1).toLowerCase()
      : ''

  const fileNameMap: Record<string, string> = {
    dockerfile: 'dockerfile'
  }

  const extMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    json: 'json',
    md: 'markdown',
    css: 'css',
    scss: 'scss',
    less: 'less',
    html: 'html',
    htm: 'html',
    xml: 'xml',
    svg: 'xml',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    ps1: 'powershell',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'ini',
    ini: 'ini',
    sql: 'sql',
    graphql: 'graphql',
    vue: 'html',
    svelte: 'html'
  }

  return fileNameMap[fileName] || extMap[ext] || 'plaintext'
}

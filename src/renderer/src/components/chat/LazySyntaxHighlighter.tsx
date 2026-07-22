import * as React from 'react'
import { useTheme } from 'next-themes'
import PrismLight from 'react-syntax-highlighter/dist/esm/prism-light'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import prismBash from 'react-syntax-highlighter/dist/esm/languages/prism/bash'
import prismC from 'react-syntax-highlighter/dist/esm/languages/prism/c'
import prismCpp from 'react-syntax-highlighter/dist/esm/languages/prism/cpp'
import prismCsharp from 'react-syntax-highlighter/dist/esm/languages/prism/csharp'
import prismCss from 'react-syntax-highlighter/dist/esm/languages/prism/css'
import prismDart from 'react-syntax-highlighter/dist/esm/languages/prism/dart'
import prismDocker from 'react-syntax-highlighter/dist/esm/languages/prism/docker'
import prismGo from 'react-syntax-highlighter/dist/esm/languages/prism/go'
import prismGraphql from 'react-syntax-highlighter/dist/esm/languages/prism/graphql'
import prismIni from 'react-syntax-highlighter/dist/esm/languages/prism/ini'
import prismJava from 'react-syntax-highlighter/dist/esm/languages/prism/java'
import prismJavascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript'
import prismJson from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import prismJsx from 'react-syntax-highlighter/dist/esm/languages/prism/jsx'
import prismKotlin from 'react-syntax-highlighter/dist/esm/languages/prism/kotlin'
import prismLess from 'react-syntax-highlighter/dist/esm/languages/prism/less'
import prismLua from 'react-syntax-highlighter/dist/esm/languages/prism/lua'
import prismMakefile from 'react-syntax-highlighter/dist/esm/languages/prism/makefile'
import prismMarkdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown'
import prismMarkup from 'react-syntax-highlighter/dist/esm/languages/prism/markup'
import prismPhp from 'react-syntax-highlighter/dist/esm/languages/prism/php'
import prismPython from 'react-syntax-highlighter/dist/esm/languages/prism/python'
import prismR from 'react-syntax-highlighter/dist/esm/languages/prism/r'
import prismRuby from 'react-syntax-highlighter/dist/esm/languages/prism/ruby'
import prismRust from 'react-syntax-highlighter/dist/esm/languages/prism/rust'
import prismScss from 'react-syntax-highlighter/dist/esm/languages/prism/scss'
import prismSql from 'react-syntax-highlighter/dist/esm/languages/prism/sql'
import prismSwift from 'react-syntax-highlighter/dist/esm/languages/prism/swift'
import prismToml from 'react-syntax-highlighter/dist/esm/languages/prism/toml'
import prismTsx from 'react-syntax-highlighter/dist/esm/languages/prism/tsx'
import prismTypescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import prismYaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml'

type SyntaxHighlighterComponent = React.ComponentType<Record<string, unknown>> & {
  registerLanguage?: (name: string, grammar: unknown) => void
}

const LANGUAGE_ALIASES: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  sh: 'bash',
  shell: 'bash',
  cs: 'csharp',
  yml: 'yaml',
  md: 'markdown',
  html: 'markup',
  htm: 'markup',
  xml: 'markup',
  svg: 'markup',
  text: 'plaintext'
}

const LANGUAGE_GRAMMARS: Record<string, unknown> = {
  typescript: prismTypescript,
  javascript: prismJavascript,
  python: prismPython,
  bash: prismBash,
  json: prismJson,
  css: prismCss,
  scss: prismScss,
  less: prismLess,
  jsx: prismJsx,
  tsx: prismTsx,
  markdown: prismMarkdown,
  yaml: prismYaml,
  rust: prismRust,
  go: prismGo,
  sql: prismSql,
  graphql: prismGraphql,
  c: prismC,
  csharp: prismCsharp,
  cpp: prismCpp,
  java: prismJava,
  kotlin: prismKotlin,
  ruby: prismRuby,
  php: prismPhp,
  swift: prismSwift,
  docker: prismDocker,
  makefile: prismMakefile,
  r: prismR,
  lua: prismLua,
  dart: prismDart,
  toml: prismToml,
  ini: prismIni,
  markup: prismMarkup
}

const Highlighter = PrismLight as unknown as SyntaxHighlighterComponent

for (const [language, grammar] of Object.entries(LANGUAGE_GRAMMARS)) {
  Highlighter.registerLanguage?.(language, grammar)
}

function normalizeLanguage(language?: string): string {
  if (!language) return 'plaintext'
  const normalized = language.toLowerCase().trim()
  return LANGUAGE_ALIASES[normalized] ?? normalized
}

type LazySyntaxHighlighterProps = Record<string, unknown> & {
  language?: string
  children: string
  className?: string
  customStyle?: React.CSSProperties
  codeTagProps?: React.HTMLAttributes<HTMLElement>
  showLineNumbers?: boolean
  startingLineNumber?: number
  lineNumberStyle?: React.CSSProperties
  wrapLongLines?: boolean
}

export function LazySyntaxHighlighter({
  language,
  children,
  className,
  customStyle,
  codeTagProps,
  ...rest
}: LazySyntaxHighlighterProps): React.JSX.Element {
  const { resolvedTheme } = useTheme()
  const normalizedLanguage = normalizeLanguage(language)
  const canHighlight =
    normalizedLanguage !== 'plaintext' &&
    Object.hasOwn(LANGUAGE_GRAMMARS, normalizedLanguage)

  if (!canHighlight) {
    return (
      <pre
        className={className ?? 'text-xs'}
        style={{
          margin: 0,
          overflowX: 'auto',
          background: 'transparent',
          color: 'var(--foreground)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
          ...(customStyle ?? {})
        }}
      >
        <code
          {...codeTagProps}
          style={{
            display: 'block',
            fontFamily: 'inherit',
            fontSize: 'inherit',
            ...(codeTagProps?.style ?? {})
          }}
        >
          {children}
        </code>
      </pre>
    )
  }

  return (
    <Highlighter
      language={normalizedLanguage}
      style={resolvedTheme === 'light' ? oneLight : oneDark}
      className={className}
      customStyle={customStyle}
      codeTagProps={codeTagProps}
      {...rest}
    >
      {children}
    </Highlighter>
  )
}

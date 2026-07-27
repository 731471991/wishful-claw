import * as React from 'react'
import { useTranslation } from 'react-i18next'

const HTML_RENDERER_SOURCE = 'open_cowork_extension_renderer'

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function stringifyData(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function readString(value: unknown): string {
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function readStringProp(source: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = readString(source[key]).trim()
    if (value) return value
  }
  return ''
}

function readArrayProp(source: Record<string, unknown>, keys: string[]): Record<string, unknown>[] {
  for (const key of keys) {
    const value = source[key]
    if (Array.isArray(value)) return value.filter(isRecord)
  }
  return []
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => readString(item).trim()).filter(Boolean)
}

function safeHttpUrl(value: unknown): string {
  const raw = readString(value).trim()
  if (!raw) return ''
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : ''
  } catch {
    return ''
  }
}

function formatFieldValue(value: unknown): string {
  const text = readString(value)
  if (text) return text
  return stringifyData(value)
}

function buildHtmlRendererDocument(html: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob: https: http:;" />
    <style>
      html, body { margin: 0; padding: 0; background: transparent; color: #e5e7eb; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
      * { box-sizing: border-box; }
    </style>
  </head>
  <body>
    ${html}
    <script>
      (() => {
        const source = ${JSON.stringify(HTML_RENDERER_SOURCE)};
        const post = (type, extra = {}) => window.parent.postMessage({ source, type, ...extra }, '*');
        const measureHeight = () => {
          const children = Array.from(document.body.children).filter((node) => {
            const tag = node.tagName;
            return tag !== 'SCRIPT' && tag !== 'STYLE';
          });
          if (children.length === 0) return 80;
          const bodyTop = document.body.getBoundingClientRect().top;
          return Math.ceil(
            Math.max(
              ...children.map((node) => {
                const rect = node.getBoundingClientRect();
                const marginBottom = Number.parseFloat(window.getComputedStyle(node).marginBottom || '0') || 0;
                return rect.bottom - bodyTop + marginBottom;
              }),
              80
            )
          );
        };
        const reportSize = () => {
          const height = measureHeight();
          post('resize', { height });
        };
        window.addEventListener('message', (event) => {
          const data = event.data;
          if (!data || data.source !== source || data.type !== 'props') return;
          window.extensionProps = data.props || {};
          window.dispatchEvent(new CustomEvent('extension-props', { detail: window.extensionProps }));
          reportSize();
        });
        if (typeof ResizeObserver !== 'undefined') {
          new ResizeObserver(reportSize).observe(document.body);
        }
        post('ready');
        requestAnimationFrame(reportSize);
        setTimeout(reportSize, 120);
      })();
    </script>
  </body>
</html>`
}


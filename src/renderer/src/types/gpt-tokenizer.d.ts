declare module 'gpt-tokenizer/encoding/cl100k_base' {
  export function encode(text: string): number[]
  export function decode(tokens: number[]): string
  export function isWithinTokenLimit(text: string, limit: number): number | false
}

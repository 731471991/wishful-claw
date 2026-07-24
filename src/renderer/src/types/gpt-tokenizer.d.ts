declare module 'gpt-tokenizer/encoding/cl100k_base' {
  interface EncodeOptions {
    allowedSpecial?: 'all' | string[]
    disallowedSpecial?: 'all' | string[]
  }
  export function encode(text: string, options?: EncodeOptions): number[]
  export function decode(tokens: Iterable<number>): string
  export function countTokens(text: string, options?: EncodeOptions): number
}

import { decode, encode } from '@msgpack/msgpack'

export function toMessagePackChannel(channel: string): string {
  return channel.endsWith(':msgpack') ? channel : `${channel}:msgpack`
}

export function encodeMessagePackPayload(value: unknown): Uint8Array {
  return encode(value)
}

export function decodeMessagePackPayload<T = unknown>(bytes: ArrayBuffer | ArrayBufferView): T {
  return decode(toUint8Array(bytes)) as T
}

export function toUint8Array(bytes: ArrayBuffer | ArrayBufferView): Uint8Array {
  if (bytes instanceof Uint8Array) return bytes
  if (bytes instanceof ArrayBuffer) return new Uint8Array(bytes)
  return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
}

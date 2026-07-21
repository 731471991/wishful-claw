export const ipcClient = {
  invoke: async (_channel: string, ..._args: unknown[]): Promise<unknown> => {
    // TODO: wire up actual IPC
    return undefined
  },
  on: (_channel: string, _handler: (...args: unknown[]) => void): (() => void) => {
    return () => {}
  },
  send: (_channel: string, ..._args: unknown[]): void => {},
}

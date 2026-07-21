export interface CommandCatalogItem {
  id: string
  name: string
  description?: string
}

export async function listCommands(): Promise<CommandCatalogItem[]> {
  return []
}

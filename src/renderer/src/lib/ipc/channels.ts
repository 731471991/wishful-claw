export const IPC = {
  SHELL_OPEN_EXTERNAL: 'shell:openExternal',
  SHELL_OPEN_PATH: 'shell:openPath',
  CLIPBOARD_WRITE_TEXT: 'clipboard:writeText',
  CLIPBOARD_WRITE_IMAGE: 'clipboard:writeImage',
  APP_GET_PLATFORM: 'app:getPlatform',
  APP_GET_VERSION: 'app:getVersion',
  FILE_READ: 'file:read',
  FILE_WRITE: 'file:write',
  FILE_EXISTS: 'file:exists',
  DIALOG_OPEN_FILE: 'dialog:openFile',
  DIALOG_SAVE_FILE: 'dialog:saveFile',
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]

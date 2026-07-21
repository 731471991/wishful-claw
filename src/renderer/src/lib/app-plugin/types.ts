export type AppPluginId = string

export const DESKTOP_CLICK_TOOL_NAME = 'desktop_click'
export const DESKTOP_SCREENSHOT_TOOL_NAME = 'desktop_screenshot'
export const DESKTOP_SCROLL_TOOL_NAME = 'desktop_scroll'
export const DESKTOP_TYPE_TOOL_NAME = 'desktop_type'
export const DESKTOP_WAIT_TOOL_NAME = 'desktop_wait'

export const BROWSER_CLICK_TOOL_NAME = 'browser_click'
export const BROWSER_GET_CONTENT_TOOL_NAME = 'browser_get_content'
export const BROWSER_NAVIGATE_TOOL_NAME = 'browser_navigate'
export const BROWSER_SCREENSHOT_TOOL_NAME = 'browser_screenshot'
export const BROWSER_SCROLL_TOOL_NAME = 'browser_scroll'
export const BROWSER_SNAPSHOT_TOOL_NAME = 'browser_snapshot'
export const BROWSER_TYPE_TOOL_NAME = 'browser_type'

export const IMAGE_GENERATE_TOOL_NAME = 'image_generate'

export const APP_PLUGIN_DESCRIPTORS: Record<string, { id: string; name: string }> = {}

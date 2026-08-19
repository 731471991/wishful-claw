/*
 * Ported from OpenCowork.
 * Original: Copyright 2026 AIDotNet
 * Licensed under the Apache License, Version 2.0 (the "License").
 * Modified by the Wishful 心相 team for Wishful Claw.
 */

import { desktopCapturer, screen } from 'electron'
import { createRequire } from 'module'

export const DESKTOP_SCREENSHOT_CAPTURE = 'desktop:screenshot:capture'
export const DESKTOP_INPUT_CLICK = 'desktop:input:click'
export const DESKTOP_INPUT_TYPE = 'desktop:input:type'
export const DESKTOP_INPUT_SCROLL = 'desktop:input:scroll'

export interface DesktopScreenshotResult {
  success: boolean
  error?: string
  width?: number
  height?: number
  originX?: number
  originY?: number
  displayCount?: number
  mediaType?: string
  data?: string
}

export interface ClickArgs {
  x: number
  y: number
  button?: 'left' | 'right' | 'middle'
  action?: 'click' | 'double_click' | 'down' | 'up'
}

export interface TypeArgs {
  text?: string | null
  key?: string | null
  hotkey?: string[] | null
}

export interface ScrollArgs {
  x?: number | null
  y?: number | null
  scrollX?: number | null
  scrollY?: number | null
}

const KEY_MAP: Record<string, string> = {
  Enter: 'enter',
  Tab: 'tab',
  Escape: 'escape',
  Backspace: 'backspace',
  Delete: 'delete',
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  Home: 'home',
  End: 'end',
  PageUp: 'pageup',
  PageDown: 'pagedown',
  Space: 'space',
  Control: 'control',
  Shift: 'shift',
  Alt: 'alt',
  Meta: 'command'
}

function resolveRobotKey(name: string): string | null {
  if (KEY_MAP[name]) return KEY_MAP[name]
  if (/^[a-zA-Z0-9]$/.test(name)) return name.toLowerCase()
  const fMatch = name.match(/^F([1-9]|1[0-2])$/)
  if (fMatch) return `f${fMatch[1]}`
  return null
}

const require = createRequire(import.meta.url)

type RobotJsModule = typeof import('@jitsi/robotjs')

let robotModule: RobotJsModule | null | undefined
let robotLoadError: string | null = null

function getRobot(): RobotJsModule | null {
  if (robotModule !== undefined) {
    return robotModule
  }

  try {
    robotModule = require('@jitsi/robotjs') as RobotJsModule
    robotLoadError = null
  } catch (error) {
    robotModule = null
    robotLoadError = error instanceof Error ? error.message : String(error)
    console.error('[DesktopControl] Failed to load @jitsi/robotjs:', error)
  }

  return robotModule
}

function getRobotUnavailableResult(): { success: false; error: string } {
  const reason = robotLoadError ? ` ${robotLoadError}` : ''
  return {
    success: false,
    error: `Desktop input is unavailable on this platform or build.${reason}`
  }
}

function isPointInsideDesktop(x: number, y: number): boolean {
  const bounds = screen.getAllDisplays().reduce(
    (acc, display) => ({
      minX: Math.min(acc.minX, display.bounds.x),
      minY: Math.min(acc.minY, display.bounds.y),
      maxX: Math.max(acc.maxX, display.bounds.x + display.bounds.width),
      maxY: Math.max(acc.maxY, display.bounds.y + display.bounds.height)
    }),
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity }
  )
  return x >= bounds.minX && x < bounds.maxX && y >= bounds.minY && y < bounds.maxY
}

export async function captureDesktopScreenshot(): Promise<DesktopScreenshotResult> {
  try {
    const primaryDisplay = screen.getPrimaryDisplay()
    const allDisplays = screen.getAllDisplays()
    const scaleFactor = primaryDisplay.scaleFactor
    const captureWidth = Math.round(primaryDisplay.bounds.width * scaleFactor)
    const captureHeight = Math.round(primaryDisplay.bounds.height * scaleFactor)

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: captureWidth, height: captureHeight }
    })

    if (sources.length === 0) {
      return { success: false, error: 'No screen sources found.' }
    }

    const primarySource =
      sources.find((s) => s.display_id === String(primaryDisplay.id)) ?? sources[0]

    const pngBuffer = primarySource.thumbnail.toPNG()
    const actualSize = primarySource.thumbnail.getSize()

    return {
      success: true,
      data: pngBuffer.toString('base64'),
      width: actualSize.width,
      height: actualSize.height,
      originX: primaryDisplay.bounds.x,
      originY: primaryDisplay.bounds.y,
      displayCount: allDisplays.length,
      mediaType: 'image/png'
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

export function desktopInputClick(
  args: ClickArgs
): { success: true; x: number; y: number; button: string; action: string } | { success: false; error: string } {
  try {
    const robot = getRobot()
    if (!robot) return getRobotUnavailableResult()

    const x = Number(args.x)
    const y = Number(args.y)
    const button = args.button ?? 'left'
    const action = args.action ?? 'click'

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return { success: false, error: 'Invalid click coordinates.' }
    }

    if (!isPointInsideDesktop(x, y)) {
      return { success: false, error: `Coordinate (${x}, ${y}) is outside the desktop bounds.` }
    }

    robot.setMouseDelay(0)
    robot.moveMouse(Math.round(x), Math.round(y))

    if (action === 'double_click') {
      robot.mouseClick(button, true)
    } else if (action === 'down') {
      robot.mouseToggle('down', button)
    } else if (action === 'up') {
      robot.mouseToggle('up', button)
    } else {
      robot.mouseClick(button)
    }

    return { success: true, x, y, button, action }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export function desktopInputType(
  args: TypeArgs
):
  | { success: true; mode: 'text'; textLength: number }
  | { success: true; mode: 'key'; key: string }
  | { success: true; mode: 'hotkey'; hotkey: string[] | null }
  | { success: false; error: string } {
  try {
    const robot = getRobot()
    if (!robot) return getRobotUnavailableResult()

    if (typeof args.text === 'string') {
      robot.setKeyboardDelay(0)
      robot.typeString(args.text)
      return { success: true, mode: 'text', textLength: args.text.length }
    }

    if (typeof args.key === 'string') {
      const resolved = resolveRobotKey(args.key)
      if (!resolved) {
        return { success: false, error: `Unsupported key: ${args.key}.` }
      }
      robot.keyTap(resolved)
      return { success: true, mode: 'key', key: args.key }
    }

    if (Array.isArray(args.hotkey) && args.hotkey.length > 1) {
      const resolvedKeys = args.hotkey.map(resolveRobotKey)
      const unsupported = args.hotkey.filter((_, i) => resolvedKeys[i] === null)
      if (unsupported.length > 0) {
        return { success: false, error: `Hotkey contains unsupported key name(s): ${unsupported.join(', ')}.` }
      }
      const keys = resolvedKeys as string[]
      const modifiers = keys.slice(0, -1)
      const mainKey = keys[keys.length - 1]
      robot.keyTap(mainKey, modifiers.length === 1 ? modifiers[0] : modifiers)
      return { success: true, mode: 'hotkey', hotkey: args.hotkey }
    }

    return { success: false, error: 'Desktop input requires text, key, or hotkey.' }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export function desktopInputScroll(
  args: ScrollArgs
): { success: true; x?: number; y?: number; scrollX: number; scrollY: number } | { success: false; error: string } {
  try {
    const robot = getRobot()
    if (!robot) return getRobotUnavailableResult()

    const x = args.x == null ? null : Number(args.x)
    const y = args.y == null ? null : Number(args.y)
    const scrollX = Number(args.scrollX ?? 0)
    const scrollY = Number(args.scrollY ?? 0)

    if (!Number.isFinite(scrollX) || !Number.isFinite(scrollY)) {
      return { success: false, error: 'Invalid scroll delta.' }
    }

    if (x !== null || y !== null) {
      if (x === null || y === null || !Number.isFinite(x) || !Number.isFinite(y)) {
        return { success: false, error: 'Invalid scroll anchor coordinates.' }
      }
      if (!isPointInsideDesktop(x, y)) {
        return { success: false, error: `Coordinate (${x}, ${y}) is outside the desktop bounds.` }
      }
      robot.setMouseDelay(0)
      robot.moveMouse(Math.round(x), Math.round(y))
    }

    robot.scrollMouse(Math.round(scrollX), Math.round(scrollY))

    return { success: true, x: x ?? undefined, y: y ?? undefined, scrollX, scrollY }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

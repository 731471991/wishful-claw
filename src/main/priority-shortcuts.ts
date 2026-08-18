import { app, globalShortcut } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import * as fs from 'fs'
import { join } from 'path'
import { logWarn } from './lib/logger'

interface ShortcutContext {
  foregroundWindow: string | null
}

interface ShortcutRegistration {
  accelerator: string
  callback: (context: ShortcutContext) => void
}

interface BridgeMessage {
  type?: string
  id?: string
  foregroundWindow?: string
}

const registrations = new Map<string, ShortcutRegistration>()
const fallbackAccelerators = new Map<string, string>()
let bridge: ChildProcessWithoutNullStreams | null = null
let stdoutBuffer = ''
let appQuitting = false
let bridgeScriptPath: string | null = null

app.on('will-quit', () => {
  appQuitting = true
  cleanupBridgeScript()
})

const WINDOWS_BRIDGE_SCRIPT = String.raw`
$source = @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Threading;

public static class PriorityHotkeyBridge
{
    private const int WH_KEYBOARD_LL = 13;
    private const int WM_KEYDOWN = 0x0100;
    private const int WM_KEYUP = 0x0101;
    private const int WM_SYSKEYDOWN = 0x0104;
    private const int WM_SYSKEYUP = 0x0105;
    private const int WM_QUIT = 0x0012;
    private const uint KEYEVENTF_KEYUP = 0x0002;
    private const uint INPUT_KEYBOARD = 1;
    private const uint LLKHF_INJECTED = 0x00000010;
    private const uint LLKHF_ALTDOWN = 0x00000020;
    private const int SW_RESTORE = 9;

    private sealed class HotkeySpec
    {
        public string Id;
        public int KeyCode;
        public bool Ctrl;
        public bool Alt;
        public bool Shift;
        public bool Win;
    }

    private static readonly object Sync = new object();
    private static readonly ManualResetEvent Ready = new ManualResetEvent(false);
    private static readonly HashSet<int> SuppressedKeys = new HashSet<int>();
    private static readonly LowLevelKeyboardProc HookProc = HookCallback;
    private static HotkeySpec[] _hotkeys = new HotkeySpec[0];
    private static IntPtr _hook = IntPtr.Zero;
    private static uint _hookThreadId;

    public static void Start()
    {
        Thread thread = new Thread(HookThreadMain);
        thread.IsBackground = true;
        thread.Name = "WishfulClaw.PriorityHotkeys";
        thread.Start();
        Ready.WaitOne(5000);
        Console.WriteLine("{\"type\":\"ready\"}");
    }

    public static void Configure(string[] entries)
    {
        List<HotkeySpec> parsed = new List<HotkeySpec>();
        foreach (string entry in entries)
        {
            int separator = entry.IndexOf('|');
            if (separator <= 0 || separator >= entry.Length - 1) continue;
            HotkeySpec spec = Parse(entry.Substring(0, separator), entry.Substring(separator + 1));
            if (spec != null) parsed.Add(spec);
        }
        lock (Sync)
        {
            _hotkeys = parsed.ToArray();
            SuppressedKeys.Clear();
        }
    }

    public static bool Paste(long windowValue)
    {
        IntPtr target = new IntPtr(windowValue);
        if (target == IntPtr.Zero || !IsWindow(target)) return false;

        if (IsIconic(target)) ShowWindow(target, SW_RESTORE);
        IntPtr foreground = GetForegroundWindow();
        uint currentThread = GetCurrentThreadId();
        uint targetThread = GetWindowThreadProcessId(target, IntPtr.Zero);
        uint foregroundThread = foreground == IntPtr.Zero ? 0 : GetWindowThreadProcessId(foreground, IntPtr.Zero);
        bool targetAttached = targetThread != 0 && targetThread != currentThread && AttachThreadInput(currentThread, targetThread, true);
        bool foregroundAttached = foregroundThread != 0 && foregroundThread != currentThread && foregroundThread != targetThread && AttachThreadInput(currentThread, foregroundThread, true);
        try
        {
            BringWindowToTop(target);
            SetForegroundWindow(target);
        }
        finally
        {
            if (foregroundAttached) AttachThreadInput(currentThread, foregroundThread, false);
            if (targetAttached) AttachThreadInput(currentThread, targetThread, false);
        }

        Thread.Sleep(80);
        INPUT[] inputs = new INPUT[]
        {
            KeyboardInput(0x11, 0),
            KeyboardInput(0x56, 0),
            KeyboardInput(0x56, KEYEVENTF_KEYUP),
            KeyboardInput(0x11, KEYEVENTF_KEYUP)
        };
        return SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT))) == inputs.Length;
    }

    public static void Stop()
    {
        if (_hookThreadId != 0) PostThreadMessage(_hookThreadId, WM_QUIT, IntPtr.Zero, IntPtr.Zero);
    }

    private static void HookThreadMain()
    {
        _hookThreadId = GetCurrentThreadId();
        _hook = SetWindowsHookEx(WH_KEYBOARD_LL, HookProc, IntPtr.Zero, 0);
        Ready.Set();
        if (_hook == IntPtr.Zero) return;

        MSG message;
        while (GetMessage(out message, IntPtr.Zero, 0, 0) > 0)
        {
            TranslateMessage(ref message);
            DispatchMessage(ref message);
        }
        UnhookWindowsHookEx(_hook);
        _hook = IntPtr.Zero;
    }

    private static IntPtr HookCallback(int code, IntPtr message, IntPtr data)
    {
        if (code < 0) return CallNextHookEx(_hook, code, message, data);
        KBDLLHOOKSTRUCT key = (KBDLLHOOKSTRUCT)Marshal.PtrToStructure(data, typeof(KBDLLHOOKSTRUCT));
        if ((key.flags & LLKHF_INJECTED) != 0) return CallNextHookEx(_hook, code, message, data);

        int eventType = message.ToInt32();
        bool isDown = eventType == WM_KEYDOWN || eventType == WM_SYSKEYDOWN;
        bool isUp = eventType == WM_KEYUP || eventType == WM_SYSKEYUP;
        int keyCode = unchecked((int)key.vkCode);

        lock (Sync)
        {
            if (isUp && SuppressedKeys.Remove(keyCode)) return new IntPtr(1);
            if (!isDown) return CallNextHookEx(_hook, code, message, data);
            if (SuppressedKeys.Contains(keyCode)) return new IntPtr(1);

            bool ctrl = IsPressed(0x11);
            bool alt = (key.flags & LLKHF_ALTDOWN) != 0 || IsPressed(0x12);
            bool shift = IsPressed(0x10);
            bool win = IsPressed(0x5B) || IsPressed(0x5C);
            foreach (HotkeySpec spec in _hotkeys)
            {
                if (spec.KeyCode != keyCode || spec.Ctrl != ctrl || spec.Alt != alt || spec.Shift != shift || spec.Win != win) continue;
                SuppressedKeys.Add(keyCode);
                long foreground = GetForegroundWindow().ToInt64();
                Console.WriteLine("{\"type\":\"pressed\",\"id\":\"" + spec.Id + "\",\"foregroundWindow\":\"" + foreground.ToString() + "\"}");
                return new IntPtr(1);
            }
        }
        return CallNextHookEx(_hook, code, message, data);
    }

    private static HotkeySpec Parse(string id, string accelerator)
    {
        string[] parts = accelerator.Split('+');
        HotkeySpec spec = new HotkeySpec();
        spec.Id = id;
        foreach (string rawPart in parts)
        {
            string part = rawPart.Trim();
            string lower = part.ToLowerInvariant();
            if (lower == "ctrl" || lower == "control" || lower == "commandorcontrol") spec.Ctrl = true;
            else if (lower == "alt" || lower == "option") spec.Alt = true;
            else if (lower == "shift") spec.Shift = true;
            else if (lower == "super" || lower == "meta" || lower == "command") spec.Win = true;
            else spec.KeyCode = ResolveKeyCode(part);
        }
        return spec.KeyCode == 0 ? null : spec;
    }

    private static int ResolveKeyCode(string key)
    {
        string upper = key.ToUpperInvariant();
        if (upper.Length == 1)
        {
            short mapped = VkKeyScan(upper[0]);
            return mapped == -1 ? 0 : mapped & 0xff;
        }
        int functionKey;
        if (upper.StartsWith("F") && int.TryParse(upper.Substring(1), out functionKey) && functionKey >= 1 && functionKey <= 24) return 0x6F + functionKey;
        switch (upper)
        {
            case "SPACE": return 0x20;
            case "RETURN": case "ENTER": return 0x0D;
            case "ESCAPE": case "ESC": return 0x1B;
            case "TAB": return 0x09;
            case "BACKSPACE": return 0x08;
            case "DELETE": return 0x2E;
            case "INSERT": return 0x2D;
            case "HOME": return 0x24;
            case "END": return 0x23;
            case "PAGEUP": return 0x21;
            case "PAGEDOWN": return 0x22;
            case "UP": return 0x26;
            case "DOWN": return 0x28;
            case "LEFT": return 0x25;
            case "RIGHT": return 0x27;
            default: return 0;
        }
    }

    private static bool IsPressed(int keyCode)
    {
        return (GetAsyncKeyState(keyCode) & 0x8000) != 0;
    }

    private static INPUT KeyboardInput(ushort keyCode, uint flags)
    {
        INPUT input = new INPUT();
        input.type = INPUT_KEYBOARD;
        input.union.keyboard = new KEYBDINPUT { wVk = keyCode, dwFlags = flags };
        return input;
    }

    private delegate IntPtr LowLevelKeyboardProc(int code, IntPtr message, IntPtr data);

    [StructLayout(LayoutKind.Sequential)]
    private struct KBDLLHOOKSTRUCT { public uint vkCode; public uint scanCode; public uint flags; public uint time; public IntPtr extraInfo; }
    [StructLayout(LayoutKind.Sequential)]
    private struct MSG { public IntPtr hwnd; public uint message; public IntPtr wParam; public IntPtr lParam; public uint time; public POINT point; }
    [StructLayout(LayoutKind.Sequential)]
    private struct POINT { public int x; public int y; }
    [StructLayout(LayoutKind.Sequential)]
    private struct INPUT { public uint type; public InputUnion union; }
    [StructLayout(LayoutKind.Explicit)]
    private struct InputUnion
    {
        [FieldOffset(0)] public MOUSEINPUT mouse;
        [FieldOffset(0)] public KEYBDINPUT keyboard;
        [FieldOffset(0)] public HARDWAREINPUT hardware;
    }
    [StructLayout(LayoutKind.Sequential)]
    private struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr extraInfo; }
    [StructLayout(LayoutKind.Sequential)]
    private struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr extraInfo; }
    [StructLayout(LayoutKind.Sequential)]
    private struct HARDWAREINPUT { public uint message; public ushort parameterLow; public ushort parameterHigh; }

    [DllImport("user32.dll", SetLastError = true)] private static extern IntPtr SetWindowsHookEx(int hookId, LowLevelKeyboardProc callback, IntPtr module, uint threadId);
    [DllImport("user32.dll")] private static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr message, IntPtr data);
    [DllImport("user32.dll", SetLastError = true)] private static extern bool UnhookWindowsHookEx(IntPtr hook);
    [DllImport("user32.dll")] private static extern int GetMessage(out MSG message, IntPtr window, uint minFilter, uint maxFilter);
    [DllImport("user32.dll")] private static extern bool TranslateMessage(ref MSG message);
    [DllImport("user32.dll")] private static extern IntPtr DispatchMessage(ref MSG message);
    [DllImport("user32.dll")] private static extern bool PostThreadMessage(uint threadId, int message, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] private static extern short GetAsyncKeyState(int keyCode);
    [DllImport("user32.dll")] private static extern short VkKeyScan(char character);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr window);
    [DllImport("user32.dll")] private static extern bool BringWindowToTop(IntPtr window);
    [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr window, int command);
    [DllImport("user32.dll")] private static extern bool IsWindow(IntPtr window);
    [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr window);
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr window, IntPtr processId);
    [DllImport("user32.dll")] private static extern bool AttachThreadInput(uint attachThread, uint attachToThread, bool attach);
    [DllImport("user32.dll", SetLastError = true)] private static extern uint SendInput(uint inputCount, INPUT[] inputs, int inputSize);
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
}
'@

Add-Type -TypeDefinition $source -Language CSharp
[PriorityHotkeyBridge]::Start()
try {
  while (($line = [Console]::In.ReadLine()) -ne $null) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $message = $line | ConvertFrom-Json
    if ($message.type -eq 'configure') {
      $entries = @($message.shortcuts | ForEach-Object { "$($_.id)|$($_.accelerator)" })
      [PriorityHotkeyBridge]::Configure([string[]]$entries)
    } elseif ($message.type -eq 'paste') {
      [void][PriorityHotkeyBridge]::Paste([long]$message.foregroundWindow)
    }
  }
} finally {
  [PriorityHotkeyBridge]::Stop()
}
`

function normalizeAccelerator(accelerator: string): string {
  return accelerator.split('+').map((part) => part.trim().toLowerCase()).sort().join('+')
}

function getWinningRegistrations(): Array<{ id: string; accelerator: string }> {
  const winners = new Map<string, { id: string; accelerator: string }>()
  for (const [id, registration] of registrations) {
    winners.set(normalizeAccelerator(registration.accelerator), { id, accelerator: registration.accelerator })
  }
  return [...winners.values()]
}

function sendToBridge(message: object): boolean {
  if (!bridge?.stdin.writable) return false
  bridge.stdin.write(`${JSON.stringify(message)}\n`)
  return true
}

function syncBridge(): void {
  if (process.platform !== 'win32') return
  sendToBridge({ type: 'configure', shortcuts: getWinningRegistrations() })
}

function handleBridgeOutput(chunk: Buffer): void {
  stdoutBuffer += chunk.toString('utf8')
  let newlineIndex = stdoutBuffer.indexOf('\n')
  while (newlineIndex >= 0) {
    const line = stdoutBuffer.slice(0, newlineIndex).trim()
    stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1)
    if (line) {
      try {
        const message = JSON.parse(line) as BridgeMessage
        if (message.type === 'ready') {
          syncBridge()
        } else if (message.type === 'pressed' && message.id) {
          registrations.get(message.id)?.callback({ foregroundWindow: message.foregroundWindow ?? null })
        }
      } catch {
        logWarn('main', `Invalid priority shortcut bridge output: ${line}`)
      }
    }
    newlineIndex = stdoutBuffer.indexOf('\n')
  }
}

function getBridgeScriptPath(): string {
  if (!bridgeScriptPath) {
    bridgeScriptPath = join(app.getPath('temp'), `wishful-claw-priority-shortcuts-${process.pid}.ps1`)
  }
  return bridgeScriptPath
}

function cleanupBridgeScript(): void {
  if (!bridgeScriptPath) return
  try {
    fs.unlinkSync(bridgeScriptPath)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    if (code !== 'ENOENT') logWarn('main', `Failed to clean priority shortcut bridge script: ${String(error)}`)
  }
  bridgeScriptPath = null
}

function ensureWindowsBridge(): boolean {
  if (process.platform !== 'win32') return false
  if (bridge) return true
  if (registrations.size === 0) return false

  try {
    const scriptPath = getBridgeScriptPath()
    fs.writeFileSync(scriptPath, WINDOWS_BRIDGE_SCRIPT, 'utf8')
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    })
    bridge = child
    child.stdout.on('data', handleBridgeOutput)
    child.stderr.on('data', (chunk: Buffer) => {
      const message = chunk.toString('utf8').trim()
      if (message) logWarn('main', `Priority shortcut bridge: ${message}`)
    })
    child.on('error', (error) => {
      if (bridge === child) bridge = null
      logWarn('main', `Priority shortcut bridge failed: ${error.message}`)
    })
    child.on('exit', (code) => {
      if (bridge === child) bridge = null
      stdoutBuffer = ''
      if (registrations.size > 0 && !appQuitting) {
        logWarn('main', `Priority shortcut bridge exited: code=${String(code)}`)
        setTimeout(() => {
          ensureWindowsBridge()
        }, 1000)
      }
    })
    return true
  } catch (error) {
    bridge = null
    logWarn('main', `Priority shortcut bridge could not start: ${String(error)}`)
    return false
  }
}

function registerFallback(id: string, registration: ShortcutRegistration): boolean {
  const oldAccelerator = fallbackAccelerators.get(id)
  if (oldAccelerator) globalShortcut.unregister(oldAccelerator)
  const registered = globalShortcut.register(registration.accelerator, () => {
    registration.callback({ foregroundWindow: null })
  })
  if (registered) fallbackAccelerators.set(id, registration.accelerator)
  else fallbackAccelerators.delete(id)
  return registered
}

export function registerPriorityShortcut(
  id: string,
  accelerator: string,
  callback: (context: ShortcutContext) => void
): boolean {
  registrations.delete(id)
  const registration = { accelerator, callback }
  registrations.set(id, registration)
  if (process.platform === 'win32') {
    if (ensureWindowsBridge()) {
      syncBridge()
      return true
    }
  }
  return registerFallback(id, registration)
}

export function unregisterPriorityShortcut(id: string): void {
  registrations.delete(id)
  const fallbackAccelerator = fallbackAccelerators.get(id)
  if (fallbackAccelerator) {
    globalShortcut.unregister(fallbackAccelerator)
    fallbackAccelerators.delete(id)
  }
  if (process.platform === 'win32') {
    syncBridge()
    if (registrations.size === 0 && bridge) {
      bridge.stdin.end()
      bridge = null
    }
  }
}

export function pasteToForegroundWindow(foregroundWindow: string | null): boolean {
  if (process.platform !== 'win32' || !foregroundWindow || foregroundWindow === '0') return false
  ensureWindowsBridge()
  return sendToBridge({ type: 'paste', foregroundWindow })
}

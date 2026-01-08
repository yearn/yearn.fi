# Codex Notifications (WSL2 -> Windows, VS Code)

resume conversation with `codex resume 019b9a77-1b95-77a0-ada2-cc992471a972`

These steps send a Windows toast and flash the VS Code taskbar icon when Codex finishes a turn or needs input.

## 1) Add the notify hook

Edit `~/.codex/config.toml` in WSL and add:

```toml
notify = ["python3", "/home/ross/.codex/codex_notify.py"]
```

## 2) Windows PowerShell notifier (toast + VS Code flash)

Save this file on Windows as:

```
C:\Users\thero\bin\codex_notify.ps1
```

```powershell
param(
  [string]$Title = 'Codex',
  [string]$Message = 'Turn complete',
  # Default: PowerShell AppID (safe fallback)
  [string]$AppId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe',
  [switch]$FlashCode
)

# Toast notification (no extra modules required)
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null

$escapedTitle = [System.Security.SecurityElement]::Escape($Title)
$escapedMessage = [System.Security.SecurityElement]::Escape($Message)

$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml("<toast><visual><binding template='ToastGeneric'><text>$escapedTitle</text><text>$escapedMessage</text></binding></visual></toast>")
$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($AppId).Show($toast)

# Flash VS Code taskbar icon
if ($FlashCode) {
  Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class Win32 {
  [DllImport("user32.dll")]
  public static extern bool FlashWindow(IntPtr hWnd, bool bInvert);
}
"@
  $proc = Get-Process Code -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 } | Select-Object -First 1
  if ($proc) { [Win32]::FlashWindow($proc.MainWindowHandle, $true) | Out-Null }
}
```

## 3) WSL-side notify shim

Save this file in WSL as:

```
~/.codex/codex_notify.py
```

```python
#!/usr/bin/env python3
import json
import subprocess
import sys


def clamp(text: str, limit: int = 200) -> str:
    cleaned = " ".join((text or "").split())
    if len(cleaned) <= limit:
        return cleaned
    return cleaned[:limit].rstrip() + "..."


event = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
etype = event.get("type") or ""
if not etype:
    sys.exit(0)

TITLE_MAP = {
    "agent-turn-complete": "Codex: turn complete",
    "approval-requested": "Codex: needs input",
    "agent-turn-error": "Codex: error",
}

title = TITLE_MAP.get(etype, f"Codex: {etype}")

summary = event.get("last-assistant-message") or ""
if not summary:
    inputs = event.get("input-messages") or []
    summary = " ".join(inputs)

message = clamp(summary, 200) or "No summary available"

subprocess.run(
    [
        "powershell.exe",
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        r"C:\Users\thero\bin\codex_notify.ps1",
        "-Title",
        title,
        "-Message",
        message,
        "-FlashCode",
    ],
    check=False,
)
```

Make it executable:

```bash
chmod +x ~/.codex/codex_notify.py
```

## Notes

- Replace the WSL username (e.g., `/home/ross`) and Windows username (`C:\Users\thero`) if yours differ.
- This setup brings VS Code to your attention but cannot jump to a specific terminal tab.
- If you want the toast to be associated with VS Code’s app icon, you can change `AppId` in the PowerShell script to VS Code’s AppID. (Optional.)
- Customize the `TITLE_MAP` or summary logic in `codex_notify.py` to change per-type notifications.

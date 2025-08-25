import json
import os
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]

errors = []

def read_text(path: Path):
    if not path.exists():
        return None
    try:
        return path.read_text(encoding='utf-8')
    except Exception as e:
        errors.append(f"Failed to read {path}: {e}")
        return None

# 1. electron/main/index.ts exists
main_ts_path = REPO_ROOT / 'electron' / 'main' / 'index.ts'
main_ts = read_text(main_ts_path)
if main_ts is None:
    errors.append('electron/main/index.ts does not exist.')

# 2-7. Security-related checks in main process
if main_ts:
    # contextIsolation: true
    if not re.search(r"contextIsolation\s*:\s*true", main_ts):
        errors.append('contextIsolation: true not found in BrowserWindow webPreferences in electron/main/index.ts')
    # sandbox: true
    if not re.search(r"sandbox\s*:\s*true", main_ts):
        errors.append('sandbox: true not found in BrowserWindow webPreferences in electron/main/index.ts')
    # nodeIntegration: false
    if not re.search(r"nodeIntegration\s*:\s*false", main_ts):
        errors.append('nodeIntegration: false not found in BrowserWindow webPreferences in electron/main/index.ts')
    # webSecurity: true
    if not re.search(r"webSecurity\s*:\s*true", main_ts):
        errors.append('webSecurity: true not found in BrowserWindow webPreferences in electron/main/index.ts')
    # setWindowOpenHandler deny
    if not (re.search(r"setWindowOpenHandler\s*\(", main_ts) and re.search(r"action\s*:\s*['\"]deny['\"]", main_ts)):
        errors.append('webContents.setWindowOpenHandler denying new windows not found in electron/main/index.ts')
    # will-navigate handler that prevents external nav
    has_will_navigate = re.search(r"will-navigate", main_ts) is not None
    prevents_default = re.search(r"preventDefault\s*\(\s*\)", main_ts) is not None
    if not (has_will_navigate and prevents_default):
        errors.append('will-navigate handler preventing disallowed navigation not found in electron/main/index.ts')

# 8. Preload exists and exposes API via contextBridge.exposeInMainWorld
preload_ts_path = REPO_ROOT / 'electron' / 'preload' / 'index.ts'
preload_ts = read_text(preload_ts_path)
if preload_ts is None:
    errors.append('electron/preload/index.ts does not exist.')
else:
    if not re.search(r"contextBridge", preload_ts):
        errors.append('electron/preload/index.ts does not reference contextBridge.')
    if not re.search(r"exposeInMainWorld\s*\(\s*['\"]\w+['\"]", preload_ts):
        errors.append('electron/preload/index.ts does not expose an API via contextBridge.exposeInMainWorld.')

# 9. ipcMain.handle('ping', ...) returns 'pong'
if main_ts:
    has_ipc_ping = re.search(r"ipcMain\.handle\s*\(\s*['\"]ping['\"]", main_ts) is not None
    returns_pong = re.search(r"['\"]pong['\"]", main_ts) is not None
    if not (has_ipc_ping and returns_pong):
        errors.append("ipcMain.handle('ping', ...) returning 'pong' not found in electron/main/index.ts")

# 10-11. package.json dev and build scripts
package_json_path = REPO_ROOT / 'package.json'
pkg_text = read_text(package_json_path)
if pkg_text is None:
    errors.append('package.json does not exist.')
else:
    try:
        pkg = json.loads(pkg_text)
        scripts = pkg.get('scripts', {}) if isinstance(pkg, dict) else {}
        dev_script = scripts.get('dev', '')
        build_script = scripts.get('build', '')
        if not dev_script:
            errors.append('package.json missing dev script.')
        else:
            # Accept common dev patterns (electron-vite dev or similar)
            if not re.search(r"electron\S*\s*vite\b|electron-vite\b|vite\s+dev|electron\s+.*dev", dev_script):
                errors.append("package.json dev script does not appear to start Electron in dev mode (expected something like 'electron-vite dev').")
        if not build_script:
            errors.append('package.json missing build script.')
        else:
            # Accept common build patterns (electron-vite build and/or electron-builder)
            if not re.search(r"electron\S*\s*vite\b.*build|electron-vite\s+build|electron-builder|build\s+.*electron", build_script):
                errors.append("package.json build script does not appear to build/package the Electron app (expected 'electron-vite build' and/or 'electron-builder').")
    except json.JSONDecodeError as e:
        errors.append(f'package.json is not valid JSON: {e}')

if errors:
    print('FAIL')
    for e in errors:
        print(f'- {e}')
    sys.exit(1)
else:
    print('PASS')
    sys.exit(0)

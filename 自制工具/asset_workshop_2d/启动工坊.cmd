@echo off
cd /d "%~dp0"
if not exist "node_modules\.pnpm\electron@44.5.1\node_modules\electron\dist\electron.exe" (
  echo Electron runtime missing. See README.md for setup.
  pause
  exit /b 1
)
if not exist "dist\task.cjs" (
  echo Build missing. Run pnpm run build first.
  pause
  exit /b 1
)
start "" "node_modules\.pnpm\electron@44.5.1\node_modules\electron\dist\electron.exe" "."

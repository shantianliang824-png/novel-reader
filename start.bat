@echo off
chcp 65001 >nul
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  echo [提示] 尚未安装依赖，请先在项目目录运行: node "C:\Users\Admin\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs" install
  pause
  exit /b 1
)
start "" "node_modules\electron\dist\electron.exe" "%~dp0"

@echo off
title HorizonAI Launcher
color 0A
echo.
echo  ╔══════════════════════════════════════╗
echo  ║       HorizonAI v1.0.0               ║
echo  ╚══════════════════════════════════════╝
echo.

REM Check .env exists
if not exist ".env" (
  echo  [!] .env file not found.
  echo  [!] Run: copy .env.template .env
  echo  [!] Then add your API keys.
  echo.
  pause
  exit /b 1
)

REM Install deps if needed
if not exist "node_modules" (
  echo  [+] Installing dependencies...
  npm install
)

echo  [+] Starting HorizonAI server...
echo  [+] Open http://localhost:3001 in your browser
echo.
start "" http://localhost:3001
node server.js

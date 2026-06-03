@echo off
title HorizonAI — Share via ngrok
color 0B
echo.
echo  ╔══════════════════════════════════════════════╗
echo  ║   HorizonAI — Public Shareable Link          ║
echo  ╚══════════════════════════════════════════════╝
echo.

REM Check ngrok is installed
where ngrok >nul 2>&1
if %errorlevel% neq 0 (
  echo  [!] ngrok not found. Downloading...
  winget install ngrok.ngrok
  echo.
)

echo  [+] Starting ngrok tunnel on port 3001...
echo  [+] Your shareable link will appear below:
echo.
ngrok http 3001

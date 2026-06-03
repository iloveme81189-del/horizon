@echo off
title Horizon — HTTPS Public URL (Cloudflare Tunnel)
color 0B
echo.
echo  +==============================================+
echo  ^|   Horizon - HTTPS Shareable Link            ^|
echo  ^|   Powered by Cloudflare Tunnel              ^|
echo  +==============================================+
echo.

REM Check if cloudflared is installed
where cloudflared >nul 2>&1
if %errorlevel% neq 0 (
  echo  [*] cloudflared not found. Installing via winget...
  winget install Cloudflare.cloudflared --accept-package-agreements --accept-source-agreements
  if %errorlevel% neq 0 (
    echo  [!] winget install failed. Download manually:
    echo  [!] https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
    echo.
    pause
    exit /b 1
  )
  echo  [OK] cloudflared installed.
  echo.
)

echo  [*] Make sure Horizon server is running in another terminal
echo  [*] (run start.bat first if not already running)
echo.
echo  [*] Starting Cloudflare Tunnel on port 3001...
echo  [*] Your HTTPS link will appear below in a few seconds:
echo  [*] Look for: https://xxxxxxxx.trycloudflare.com
echo.
echo  -------------------------------------------------------
cloudflared tunnel --url http://localhost:3001

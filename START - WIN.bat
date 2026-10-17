@echo off
setlocal
rem Jangan mewarisi mode CLI Electron dari terminal/aplikasi pengembang.
set "ELECTRON_RUN_AS_NODE="
set "ELECTRON_RENDERER_URL="
rem Naraflow - klik 2x file ini untuk membuka aplikasi di Windows.
cd /d "%~dp0"
title Naraflow

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js belum terpasang di komputer ini.
  echo  Unduh versi LTS dari https://nodejs.org, pasang, lalu klik 2x START - WIN.bat lagi.
  echo.
  start "" "https://nodejs.org/en/download"
  pause
  exit /b 1
)

rem Pertama kali dibuka, atau folder node_modules berasal dari OS lain: pasang ulang.
if not exist "node_modules\.bangstory-windows" (
  if exist "node_modules" (
    echo  Membersihkan node_modules lama...
    rmdir /s /q "node_modules"
  )
  echo.
  echo  Menyiapkan Naraflow untuk pertama kali.
  echo  Butuh koneksi internet dan beberapa menit, jangan tutup jendela ini...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  Gagal memasang. Periksa koneksi internet lalu coba lagi.
    pause
    exit /b 1
  )
  echo ok> "node_modules\.bangstory-windows"
)

rem Electron mengunduh programnya sendiri saat pertama dipakai.
if not exist "node_modules\electron\dist\electron.exe" (
  echo  Mengunduh Electron...
  call node "node_modules\electron\install.js"
  if errorlevel 1 (
    echo.
    echo  Gagal mengunduh Electron. Periksa koneksi internet lalu coba lagi.
    pause
    exit /b 1
  )
)

rem FFmpeg mengunduh binary-nya saat pertama dipakai.
if not exist "node_modules\ffmpeg-static\ffmpeg.exe" (
  echo  Mengunduh FFmpeg...
  call node "node_modules\ffmpeg-static\install.js"
  if errorlevel 1 (
    echo.
    echo  Gagal mengunduh FFmpeg. Periksa koneksi internet lalu coba lagi.
    pause
    exit /b 1
  )
)

set "NARAFLOW_NEEDS_BUILD="
if not exist "out\main\index.js" set "NARAFLOW_NEEDS_BUILD=1"
if not exist "out\preload\index.js" set "NARAFLOW_NEEDS_BUILD=1"
if not exist "out\renderer\index.html" set "NARAFLOW_NEEDS_BUILD=1"
if defined NARAFLOW_NEEDS_BUILD (
  echo  Menyusun aplikasi...
  call npm run build
  if errorlevel 1 (
    echo.
    echo  Gagal menyusun aplikasi.
    pause
    exit /b 1
  )
)

start "" "node_modules\electron\dist\electron.exe" .
if errorlevel 1 (
  echo.
  echo  Naraflow gagal dibuka. Periksa file Electron dan folder aplikasi.
  pause
  exit /b 1
)
exit /b 0

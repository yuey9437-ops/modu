@echo off
cd /d "%~dp0"
title Modu Reader - local preview
set PORT=8848
echo.
echo   Modu Reader / local preview
echo   http://127.0.0.1:%PORT%
echo   Press Ctrl+C to stop.
echo.
start "" "http://127.0.0.1:%PORT%/"
python -m http.server %PORT%
pause
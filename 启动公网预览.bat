@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   墨读 · 公网预览
echo   ----------------------------------------
echo   正在启动本地服务并申请公网地址，请稍候…
echo.
python tools\public_preview.py
echo.
echo   隧道已停止，地址失效。
pause
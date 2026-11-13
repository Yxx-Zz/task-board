@echo off
chcp 65001 >nul
title 教学组 · 今日任务板
echo.
echo   ╔══════════════════════════════════════╗
echo   ║   教学组 · 今日任务板               ║
echo   ╚══════════════════════════════════════╝
echo.
echo   正在启动服务...
echo.
cd /d "%~dp0"
node server.js
pause
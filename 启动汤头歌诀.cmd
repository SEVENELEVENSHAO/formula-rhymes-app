@echo off
cd /d "%~dp0"
if not exist node_modules call npm install
if errorlevel 1 exit /b 1
if not exist dist\index.html call npm run build
if errorlevel 1 exit /b 1
start "" "http://127.0.0.1:5178/"
call npm run preview

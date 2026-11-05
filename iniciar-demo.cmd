@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0iniciar-demo.ps1" %*
set CODIGO=%ERRORLEVEL%
if not "%CODIGO%"=="0" (
    echo.
    echo La demo no pudo arrancar. Codigo: %CODIGO%
    pause
)
exit /b %CODIGO%

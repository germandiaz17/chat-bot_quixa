@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0detener-demo.ps1" %*
set CODIGO=%ERRORLEVEL%
if not "%CODIGO%"=="0" (
    echo.
    echo No se pudo detener todo. Codigo: %CODIGO%
    pause
)
exit /b %CODIGO%

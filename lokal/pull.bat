@echo off
setlocal
cd /d "%~dp0.."

echo.
echo === KB: PULL ===
git pull
if errorlevel 1 (
    echo.
    echo Pull gagal. Periksa koneksi atau konflik Git.
    exit /b 1
)

echo.
echo Pull selesai.
exit /b 0

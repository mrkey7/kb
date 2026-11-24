@echo off
setlocal
cd /d "%~dp0.."

echo.
echo === KB: PUSH ===
git add -A

git diff --cached --quiet
if not errorlevel 1 (
    echo Tidak ada perubahan untuk di-commit.
    exit /b 0
)

git commit -m "Update KB"
if errorlevel 1 (
    echo.
    echo Commit gagal.
    exit /b 1
)

git push
if errorlevel 1 (
    echo.
    echo Push gagal. Periksa koneksi atau status repository.
    exit /b 1
)

echo.
echo Push selesai.
exit /b 0

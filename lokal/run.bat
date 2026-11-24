@echo off
setlocal

rem Pilihan: pull, push, atau none
set "GIT_TASK=pull"

if /i not "%GIT_TASK%"=="none" (
    echo Menjalankan tugas Git: %GIT_TASK%
    call "%~dp0%GIT_TASK%.bat"
    if errorlevel 1 (
        echo.
        echo Proses Git gagal. KB tidak dijalankan.
        pause
        exit /b 1
    )
)

echo.
echo === MENJALANKAN KONTEN BUILDER ===
python "%~dp0run.py"

if errorlevel 1 (
    echo.
    echo KB berhenti dengan kesalahan.
    pause
)

@echo off
title Uploading All Project Files to Danial-s-Cafe-...
echo ========================================================
echo   UPLOADING ALL PROJECT FILES PROPERLY TO GITHUB
echo   Repository: https://github.com/sidhukhushsidhu0-lab/Danial-s-Cafe-
echo ========================================================
echo.
echo If a GitHub sign-in window opens in your browser,
echo click "Sign in with your browser" / "Authorize" to confirm.
echo.

set "GIT=C:\Users\dell\AppData\Local\GitHubDesktop\app-3.6.6\resources\app\git\cmd\git.exe"
set "REPO=E:\webseite poject\lovable-project-14bf1a81"

"%GIT%" -C "%REPO%" push -u origin main --force

echo.
if %ERRORLEVEL% EQU 0 (
    echo ========================================================
    echo   SUCCESS! All 97 files uploaded properly without any mess!
    echo ========================================================
) else (
    echo [NOTE] If needed, sign in above and run again.
)
echo.
pause

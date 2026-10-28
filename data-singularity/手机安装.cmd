@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

echo.
echo   黑洞 · 手机安装
echo   ---------------------------------------------
echo   1. 手机和电脑连同一个 Wi-Fi
echo   2. 手机浏览器打开 http://电脑IP:8899
echo   3. 菜单里选「安装应用」或「添加到主屏幕」
echo   ---------------------------------------------
echo.

set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY ( where py >nul 2>nul && set "PY=py -3" )
if not defined PY if exist "%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe" set "PY=%USERPROFILE%\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\python\python.exe"
if not defined PY set "PY=python"

ipconfig | findstr /C:"IPv4"
echo.
%PY% -m http.server 8899 --bind 0.0.0.0
pause

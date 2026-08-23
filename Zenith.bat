@echo off
title Zenith Browser
cd /d "%~dp0"
start "" "%~dp0node_modules\electron\dist\electron.exe" .
exit

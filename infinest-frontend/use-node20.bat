@echo off
echo Switching to Node.js v20.17.0 for this session...
set PATH=C:\nodejs-portable\node-v20.17.0-win-x64;%PATH%
echo Node.js version:
node --version
echo npm version:
npm --version
echo.
echo Environment ready! You can now run npm commands with Node.js v20.x
echo To build the project: npm run build
cmd /k
@echo off
rem Murga-o-matic: arma la version liviana (offline/), verifica que este completa (con Chrome) y, si esta todo bien,
rem la sube a la rama gh-pages de GitHub, de donde la sirve GitHub Pages. Es lo mismo que "npm run publicar"
rem (herramientas/publicar.mjs). Publica lo commiteado: con cambios sin commit, no publica.
cd /d "%~dp0"
call npm run publicar
pause

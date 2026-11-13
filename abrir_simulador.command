#!/bin/bash
# Abre el simulador sin internet: doble clic en este archivo (Mac).
# Levanta un servidor local en esta carpeta y abre el navegador.
cd "$(dirname "$0")"
PUERTO=8765
python3 -m http.server $PUERTO &
SERVIDOR=$!
sleep 1
open "http://localhost:$PUERTO/jurado.html"
echo "Simulador en http://localhost:$PUERTO  (cierra esta ventana para apagarlo)"
wait $SERVIDOR

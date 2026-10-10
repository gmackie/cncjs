#!/bin/sh
# Shapeoko touchscreen. Never opens the controller; badge gates remain server-side.
set -eu
export DISPLAY="${DISPLAY:-:0}"
export XAUTHORITY="${XAUTHORITY:-/home/pi/.Xauthority}"
xset -dpms || true
xset s off || true
xset s noblank || true
until curl -fsS http://127.0.0.1:8000/ >/dev/null; do
    sleep 2
done
exec chromium-browser --noerrdialogs --disable-infobars --no-first-run \
    --user-data-dir=/home/pi/.config/shapeoko-kiosk \
    --kiosk 'http://127.0.0.1:8000/#/shop'

# Shapeoko kiosk

The Pi screen opens `http://127.0.0.1:8000/#/shop`. The custom Shapeoko shell owns queue review, milling/laser guides, daily setup, commissioning, machine controls and usage. CNCjs supplies the API, serial connection and G-code streaming.

Enable `CNCJS_KIOSK=1` in the CNCjs service environment with badge protection enabled (`CNCJS_BADGE_ACCESS` must not be `0`). Local signin then issues a scoped `role=kiosk` session instead of requiring an administrator password. Issuance requires a direct loopback connection, a literal loopback Host and matching Origin when present; forwarded addresses are not trusted. Kiosk bearer requests must stay local. These tokens are rejected when kiosk mode or badge protection is disabled; existing sockets also fail closed. The existing HTTP/socket badge gates still require FabForge machine authorization and availability before motion, and prohibit administrator endpoints. Remote browsers retain account sign-in.

`shapeoko-kiosk.service` runs `start-kiosk.sh` after the display/backend, waits for HTTP readiness, and restarts Chromium if it exits. The dedicated `/home/pi/.config/shapeoko-kiosk` profile leaves the previous browser profile intact. Disable the old Openbox Chromium launch when enabling this service so only one kiosk runs. Set its environment URL to port8000 as well. Do not use automatic serial connection at boot.

The camera rail stays mounted across all custom routes. Preview starts automatically, refreshes snapshots every 1.5 seconds, retries errors every 5 seconds, and pauses in a hidden browser tab. The operator may close it temporarily; reloading starts it again. Viewing a camera does not grant machine control or prove readiness.

Deploy frontend assets and the kiosk authentication files together. Back up the current application and Openbox configuration first. Check no controller is connected before a backend restart. Verify local signin without printing tokens, locked viewer controls, refusal of account/admin APIs and remote kiosk token reuse, then inspect the actual Pi screen. No reboot, homing or probing is required for this software installation.

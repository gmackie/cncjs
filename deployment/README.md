# Shapeoko workshop deployment

Host: `pi@192.168.68.138`, Raspberry Pi 3 Model B, 32-bit Raspbian 10.
Dashboard: `http://192.168.68.138:8000/#/shop`.

## Installed 2026-10-07

- cncjs 1.11.5 from npm, with the application assets built from this branch.
- Node 22.23.3 official armv7l binary under `/home/pi/cncjs-upgrade`.
- `cncjs-shop.service` runs as pi and reads the existing `/home/pi/.cncrc`.
- Previous cncjs 1.9.22 / Node 10 installation retained under `.nvm`.
- Previous `pm2-pi.service` stopped and disabled, not deleted.
- Removed the nonexistent tinyweb mount from the new service's command line.
- No firmware changes, serial-port opens, homing, probing, spindle or laser commands were performed during deployment.

The original configuration, PM2 process dump and unit file are archived at
`/home/pi/cncjs-pre-upgrade-20261007.tar.gz`. A second copy is stored on the development
machine at `/Users/mackieg/cncjs-backups/2026-10-07/pi-config.tar.gz`.
These archives contain credentials; keep them private and outside version control.
This is a configuration backup, not a full SD-card image.

## Runtime compatibility bridge

Buster's system C++ library cannot run current Node. System libraries were left intact.
The following Debian armhf packages were extracted, not installed, under
`/home/pi/cncjs-upgrade/compat`:

- `libc6_2.31-13+deb11u11_armhf.deb`
- `libstdc++6_10.2.1-6_armhf.deb`
- `libgcc-s1_10.2.1-6_armhf.deb`

`/home/pi/cncjs-upgrade/bin/node` invokes the private loader:

```sh
#!/bin/sh
exec /home/pi/cncjs-upgrade/compat/lib/arm-linux-gnueabihf/ld-linux-armhf.so.3 \
  --library-path /home/pi/cncjs-upgrade/compat/lib/arm-linux-gnueabihf:/home/pi/cncjs-upgrade/compat/usr/lib/arm-linux-gnueabihf \
  /home/pi/cncjs-upgrade/node-v22.23.3-linux-armv7l/bin/node "$@"
```

Do not export these private libraries globally. This bridge does not update or
support the old OS. Replace it with a supported Raspberry Pi OS installation on a
separate card after resolving the reported undervoltage (`0x50005`). Preserve the
old card for rollback and verify USB serial functionality on the new OS.

## Verify and roll back

```sh
systemctl status cncjs-shop
journalctl -u cncjs-shop -n 50 --no-pager
curl -f http://127.0.0.1:8000/ >/dev/null
```

With the machine idle, rollback to the old installation:

```sh
sudo systemctl disable --now cncjs-shop
sudo systemctl enable --now pm2-pi
```

The configuration was unchanged by deployment. If a later change requires restoring
it, first stop cncjs, save the current `.cncrc`, then restore only `.cncrc` from the
archive. Do not overwrite newer settings without reviewing them.

## Rebuild the UI

```sh
yarn install --immutable
yarn build
COPYFILE_DISABLE=1 tar --no-xattrs -czf /tmp/cncjs-shop-ui.tar.gz -C dist/cncjs app
```

Copy the archive to the Pi. Extract into
`/home/pi/cncjs-upgrade/app/node_modules/cncjs/dist/cncjs` and restart only when idle.
The original 1.11.5 assets are in `/home/pi/cncjs-upgrade/stock-ui.tar.gz`.
A same-version UI update should be followed by a hard refresh because the asset
URL prefix is derived from the cncjs version. The production build now fails immediately if any build stage fails.

## Machine commissioning still required

The existing tool-setting macros contain fixed machine coordinates. No physical
probe test was performed. The dashboard requires a fresh idle Grbl report, idle
sender, `$32=0`, review of the macro and an operator acknowledgement before
submitting it. Submission is not proof that a probe completed. Paused job tool
changes remain in the existing workspace workflow.

The J Tech **7W** laser is not wired or commissioned. Its page shows installation
guidance and reported `$30`, `$31`, `$32` values; it never fires the laser or writes
controller settings. Confirm head/driver revision, wiring, focus, mount clearance,
firmware support, power scale and laser protection before a supervised test.
Reference: https://jtechphotonics.com/?page_id=3145

At initial deployment these checks were deferred. The follow-up below verifies firmware
and serial I/O; actual cutting/probing and reboot validation still require supervision.

## Controller verified 2026-10-07 (second session)

The owner confirmed the machine was clear with router/laser power off and authorized
connection and settings inspection. The current runtime opened `/dev/ttyACM0` through
cncjs successfully. Read-only `$I`, `$$`, `$G`, `$#` queries reported:

- Grbl `1.1f.20170131`, options `VNPR,14,128`.
- `$32=0` (milling), `$30=1000`, `$31=0`; laser-mode support exists.
- `$22=1` (homing enabled); startup state `Alarm`.
- `$20=0`, `$21=0` (soft and hard limits disabled).
- `$130=845`, `$131=850`, `$132=95` mm.
- Spindle `M5`, coolant `M9`, probe result not established.

The owner confirmed **XL**, not XXL. Stored Y travel of 850 mm needs measurement
and correction during supervised commissioning. Do not guess a replacement or
turn on soft limits before verifying actual usable travel. Firmware settings and
saved probe coordinates have not been changed. The owner deferred homing; no
homing, jog, probing or output commands were sent.

A read-only snapshot is stored at `/home/pi/cncjs-upgrade/controller-inspection.json`.

## USB camera preparation

The owner has a camera but has not connected it yet. `/dev/video10` through
`/dev/video16` are Pi codec/ISP devices, **not webcams**.

`cncjs-camera.service` waits for `/dev/v4l/by-id/usb-*-video-index0`. Once a camera
appears it launches MJPG-streamer bound only to `127.0.0.1:8081`. The cncjs service
proxies `/camera/` to that stream. The mount uses cncjs's existing LAN-accessible
proxy mechanism; camera URLs do not require the UI login. Do not expose the cncjs
port publicly.

- Dashboard **Camera → Show camera**: snapshots every 1.5 seconds, timeout/error
  feedback, explicit off/retry controls. This is monitoring, not a safety interlock.
- Workspace **Webcam → Settings → Raspberry Pi USB camera → Save Changes**, then
  enable the widget: continuous MJPEG at `camera/?action=stream`.
- Browser camera access means a camera plugged into the laptop/tablet, not the Pi.

The default camera profile is native MJPEG, 640×480, 10 fps. After plugging it in:

```sh
v4l2-ctl --list-devices
v4l2-ctl -d /dev/v4l/by-id/<your-camera>-video-index0 --list-formats-ext
systemctl status cncjs-camera
journalctl -u cncjs-camera -n 30 --no-pager
```

Set `CAMERA_DEVICE`, `CAMERA_RESOLUTION`, `CAMERA_FPS` in
`/home/pi/cncjs-camera/camera.env` if necessary. For cameras without MJPEG, use
`CAMERA_INPUT_OPTIONS=-y` for YUYV conversion (higher CPU load), then restart
`cncjs-camera`. Actual formats, focus, mounting and image quality await the camera.

Build provenance: jacksonliam/mjpg-streamer revision
`310b29f4a94c46652b20c4b7b6e5cf24e532af39`, GPL source retained in
`/home/pi/cncjs-camera/mjpg-streamer-experimental`. See `build-camera.sh` for the
Buster build recipe. Only JPEG headers were extracted from the matching Debian
package; the existing Pi libjpeg runtime is used. No OS packages were upgraded.

Install the scripts and unit:

```sh
cp deployment/start-camera.sh /home/pi/cncjs-camera/
cp deployment/camera.env.example /home/pi/cncjs-camera/camera.env
sudo cp deployment/cncjs-camera.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now cncjs-camera
```

Use the updated `cncjs-shop.service` and compiled server proxy error handler before
adding the camera mount. Without a camera, `/camera/?action=snapshot` returns 503
and the CNC server stays responsive. A labeled **NOT A LIVE CAMERA** JPEG verified
both the snapshot and multipart stream paths; this does not validate real capture.
The fixture streamer is stopped after testing. Roll back camera support by removing
the `/camera` mount and stopping/disabling `cncjs-camera`.

## Reviewed dashboard macros

Dashboard submissions use `macro:run-reviewed`. Before enqueueing, the Grbl server
checks that the saved macro still exactly matches the reviewed text, the serial
connection is open, the reported machine and workflow are idle, `$32=0`, and the
feeder has no queued, pending, or held commands. Rejections return an explanation
and require another review. The legacy workspace macro command is unchanged for
existing paused tool-change workflows. These checks use reported controller state;
they do not establish homing, validate probe coordinates, or replace supervision.

Regression coverage verifies rejected submissions produce no serial writes and a
matching reviewed macro can run against a simulated idle milling controller.
Physical homing, BitSetter calibration, measured XL travel, laser wiring and output
testing, and real USB camera capture remain the commissioning follow-ups.

## USB camera commissioned 2026-10-08

Connected camera: Xiongmai UVC, stable ID
`usb-Xiongmai_web_camera_12345678-video-index0`. Real snapshots and multipart video
were verified through the CNCjs proxy: HTTP 200, 37 JPEG frames in four seconds.
The view shows the Shapeoko; mounting/focus still need operator adjustment.

The first real USB capture exposed a build defect: the streamer executable did
not export helpers used by `input_uvc.so` (`parse_resolution_opt` and
`resolutions_help`). The labeled file-input fixture could not detect this.
`build-camera.sh` now links with `--export-dynamic` and runs the real UVC plugin
with `LD_BIND_NOW=1` and `--help`, resolving dependencies without opening hardware.
This check failed with the old executable and passes with the rebuilt executable.

The Pi profile now uses supported MJPEG 640×360 at 30 camera fps with
`CAMERA_INPUT_OPTIONS=-softfps 10` to publish about 10 fps. The generic example
profile remains unchanged for other cameras. Only the camera service was restarted;
CNCjs and the motion controller were left running. Backups are
`/home/pi/cncjs-camera/mjpg_streamer.pre-export-fix` and
`/home/pi/cncjs-camera/camera.env.pre-format-fix`.

The Pi again reports active undervoltage/throttling (`0x50005`). Check its power
supply/cable and USB power budget before machine commissioning. Manual control
is reported working by the owner; homing, travel calibration, BitSetter and laser
commissioning remain unverified.

## FabForge integration

The shop queue and offline G-code review page is `/#/fabforge`, connected to
`https://fab.forgegraf.com` and Graham Mackie's workspace. See [fabforge.md](fabforge.md)
for the API contract, scoped resource, simulation limits and operator workflow.
The Shapeoko resource is marked restricted pending physical commissioning.
Credentials live in a private environment file loaded by a systemd drop-in.
Rollback archive: `/home/pi/cncjs-upgrade/pre-fabforge.tgz`. Restore it into the
application's `dist/cncjs` directory with CNCjs stopped and remove the FabForge
systemd drop-in, then reload systemd/start CNCjs. Do this only with an idle machine.

## Operator handbooks

- [DWP611: installation, ⅛-inch tooling, BitSetter, milling and recovery](guides/dwp611.md)
- [J Tech 7W: identification, installation, commissioning and engraving](guides/jtech-7w.md)

Printable HTML copies are shipped in `src/app/assets/guides/` and linked from the
Milling and Laser pages. To regenerate after editing Markdown, run
`python3 deployment/guides/render.py` (requires `markdown2`). The generated files
are checked in; the Pi requires no Markdown renderer or network access to read them.
Exact laser pinout/focus remain conditional on identifying the installed hardware.

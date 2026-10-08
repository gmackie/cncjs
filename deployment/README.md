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
URL prefix is derived from the cncjs version. Validate the build log: the existing
build script does not fail fast on every subcommand failure.

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

Firmware identification, serial I/O under the new runtime, actual cutting/probing,
and reboot validation were deliberately left for supervised commissioning.

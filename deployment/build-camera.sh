#!/bin/sh
# Run on the existing 32-bit Buster Pi; installs no system packages.
set -eu
camera_root=${CAMERA_ROOT:-/home/pi/cncjs-camera}
mkdir -p "$camera_root"
cd "$camera_root"
revision=310b29f4a94c46652b20c4b7b6e5cf24e532af39
curl -fLsS "https://github.com/jacksonliam/mjpg-streamer/archive/$revision.tar.gz" -o source.tar.gz
tar -xzf source.tar.gz
curl -fLsS 'https://archive.debian.org/debian/pool/main/libj/libjpeg-turbo/libjpeg62-turbo-dev_1.5.2-2+deb10u1_armhf.deb' -o jpeg-dev.deb
dpkg-deb -x jpeg-dev.deb headers
cd "mjpg-streamer-$revision/mjpg-streamer-experimental"
# USB plugins resolve shared helpers from the executable at dlopen time.
gcc -O2 -Wl,--export-dynamic -o "$camera_root/mjpg_streamer" mjpg_streamer.c utils.c -lpthread -ldl
gcc -O2 -shared -fPIC -DLINUX -D_GNU_SOURCE \
    -I"$camera_root/headers/usr/include" -I"$camera_root/headers/usr/include/arm-linux-gnueabihf" \
    -o "$camera_root/input_uvc.so" plugins/input_uvc/input_uvc.c plugins/input_uvc/v4l2uvc.c \
    plugins/input_uvc/jpeg_utils.c plugins/input_uvc/dynctrl.c -l:libjpeg.so.62 -lpthread
gcc -O2 -shared -fPIC -D_GNU_SOURCE -o "$camera_root/output_http.so" \
    plugins/output_http/httpd.c plugins/output_http/output_http.c -lpthread
# File input is only for explicitly labeled installation tests, never live viewing.
gcc -O2 -shared -fPIC -D_GNU_SOURCE -o "$camera_root/input_file.so" plugins/input_file/input_file.c -lpthread

# Resolve every USB-plugin symbol without opening a camera. A file-input fixture
# does not cover these dependencies. Missing exports must fail the build.
cd "$camera_root"
LD_BIND_NOW=1 ./mjpg_streamer -i './input_uvc.so --help' -o './output_http.so --help'

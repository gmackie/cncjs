#!/bin/sh
set -eu
cd /home/pi/cncjs-camera
# Override with a stable /dev/v4l/by-id/... path in camera.env if needed.
# Never select the Pi's codec/ISP /dev/video10+ devices as a webcam.
waiting_logged=0
while :; do
    camera_device=${CAMERA_DEVICE:-}
    if [ -z "$camera_device" ]; then
        for candidate in /dev/v4l/by-id/usb-*-video-index0; do
            if [ -c "$candidate" ]; then
                camera_device=$candidate
                break
            fi
        done
    fi
    if [ -n "$camera_device" ] && [ -c "$camera_device" ]; then
        waiting_logged=0
        echo "Starting USB camera: $camera_device"
        # MJPEG keeps CPU usage down on a Pi 3. Select -y explicitly only for
        # cameras that offer YUYV but no MJPEG at the configured resolution.
        ./mjpg_streamer \
            -i "./input_uvc.so -d $camera_device -r ${CAMERA_RESOLUTION:-640x480} -f ${CAMERA_FPS:-10} -n ${CAMERA_INPUT_OPTIONS:-}" \
            -o './output_http.so -l 127.0.0.1 -p 8081 -n' || true
        echo 'Camera disconnected or capture failed; retrying in 10 seconds.'
    else
        if [ "$waiting_logged" -eq 0 ]; then
            echo 'Waiting for a USB webcam.'
            waiting_logged=1
        fi
    fi
    sleep 10
done

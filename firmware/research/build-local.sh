#!/bin/sh
# Local compilation only. Requires the verified Arduino AVR toolchain on PATH.
set -eu
research_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
build_dir=$(mktemp -d "${TMPDIR:-/tmp}/cncjs-grbl.XXXXXX")
tar -xzf "$research_dir/sources/grbl-1.1f.tar.gz" -C "$build_dir" --strip-components=1
cp "$research_dir/artifacts/carbide-config-2017.h" "$build_dir/grbl/config.h"
mkdir -p "$build_dir/build"
make -C "$build_dir" grbl.hex
avr-size -A "$build_dir/build/main.elf"
printf 'Research build retained at %s\n' "$build_dir"
# Do not use upstream make install: it invokes BOTH flash and fuse targets.

# Shapeoko firmware research

Offline investigation, 2026-10-09. No controller connection, flash, EEPROM write,
fuse operation or machine motion was performed.

Open `findings.html` for the evidence and implications. `manifest.json` records
retrieval URLs and SHA-256 hashes; `analysis.json` records validated HEX contents.
These hashes identify our downloaded copies, not vendor signatures or the firmware
currently installed on the machine.

## Reproduce

```sh
python3 firmware/research/analyze.py
python3 -m unittest discover -s firmware/research -p 'test_*.py'
diff -u firmware/research/upstream/config-1.1f.h firmware/research/artifacts/carbide-config-2017.h
```

The manifest pins an Arduino AVR GCC 7.3.0 toolchain for Intel macOS (ran on this
host). Download it outside the repository, verify its SHA-256 before extraction,
and put its `avr/bin` directory on PATH. Then:

```sh
sh firmware/research/build-local.sh
avr-objdump -b ihex -m avr5 -D firmware/research/artifacts/carbide-v4-grbl.hex > /tmp/carbide-v4-grbl.asm
```

The build script retains a new temporary directory with HEX, ELF and objects and
never invokes a programmer. **Do not run upstream `make install`: it invokes both
flash and fuse targets.** Raw disassembly has no original symbols and decodes
embedded data as instructions; use the locally built ELF for symbolic analysis,
without transferring its addresses to the different archived image.

Measured local build: `.text=31548`, `.data=0`, `.bss=1665`, ATmega328P, 16 MHz,
`-Os -ffunction-sections -flto`, upstream Makefile `grbl.hex` target. The compiler emits two warnings about the existing boolean checksum expression
in upstream `eeprom.c`; those source lines are preserved, not silently changed.
The original Carbide compiler/build environment is unknown. This is not a byte-identical build
and is not approved for installation. HEX files here contain application images,
not a complete flash/EEPROM/bootloader/fuse backup.

## Source and license

Grbl sources and firmware are GPL-3.0-or-later; see `upstream/COPYING` and original
file notices. Both upstream release source archives are retained in `sources/`.
Carbide's published config is retained unmodified with its original notices.
The archived Carbide HEX was obtained from the Internet Archive because the
original vendor URL returned 404. The source/config combination is a research
candidate for that binary, not verified exact corresponding build inputs. Do not
present it as a reproducible vendor release or redistribute a modified firmware
release without its complete corresponding source and build instructions.

The offline research bundle in firmware/research validates archived Carbide 1.1f and upstream 1.1f/1.1h images. Upstream 1.1f plus Carbide's published config builds with AVR GCC 7.3.0, but the result is 31,548 bytes versus the archived 31,920-byte image.

Follow-up:
- Recover the original compiler/options/source inputs and attempt a byte-identical archived-image build; preserve the historical EEPROM checksum behavior.
- Plan separately authorized controller flash/EEPROM/bootloader/fuse readback and recovery verification. Version/options reports alone do not establish binary identity.
- Bench-test door/hold/parking, reset, probe and laser PWM behavior with tools disconnected before considering installation.
- Verify board interfaces and bootloader reservation; confirm XL travel and commissioning independently of firmware research.

This issue authorizes no controller connection, flashing, fuse writes or machine motion. Research findings and source provenance are in firmware/research/findings.html and manifest.json.

Tracking note: GitHub issues are disabled for this fork and no Beads database is
configured. This checked-in follow-up records the remaining work instead.

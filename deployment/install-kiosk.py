#!/usr/bin/env python3
"""Add kiosk guard to the installed npm app without replacing its route table."""
from pathlib import Path
import sys

path = Path(sys.argv[1])
source = path.read_text()
if "_kiosk.kioskGuard" in source:
    raise SystemExit('Kiosk guard already installed; inspect before reapplying.')
changes = [
    ('var _urljoin =', 'var _kiosk = require("./lib/kiosk");\nvar _urljoin ='),
    ('              bypass = true;', '              req.user = user;\n              bypass = true;'),
    ('    // Register API routes with public access', '    app.use((0, _urljoin["default"])(_settings["default"].route, "api"), _kiosk.kioskGuard);\n    // Register API routes with public access'),
]
for old, new in changes:
    if source.count(old) != 1:
        raise SystemExit('Unexpected app.js layout: ' + old)
    source = source.replace(old, new, 1)
path.write_text(source)

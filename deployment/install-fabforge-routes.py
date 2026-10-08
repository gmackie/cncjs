#!/usr/bin/env python3
"""Add just the FabForge routes to an existing npm CNCjs 1.11.5 route table.

The fork also has unrelated watch-file routes that npm's API does not implement.
Do not replace npm server/app.js with the fork's full compiled route table.
"""
import sys
from pathlib import Path

route_file = Path(sys.argv[1])
source = route_file.read_text()
if "api/fabforge/status" in source:
    print("FabForge routes already installed")
    sys.exit(0)
marker = "    // G-code\n"
if source.count(marker) != 1 or 'var api = ' not in source:
    raise SystemExit("Unrecognized CNCjs route table; no changes made")
routes = [
    ("get", "status", "status"),
    ("get", "work-orders", "queue"),
    ("get", "work-orders/:id", "detail"),
    ("post", "work-orders/:id/jobs/:jobId/review", "review"),
    ("post", "work-orders/:id/jobs/:jobId/validations", "record"),
    ("post", "work-orders/:id/jobs/:jobId/disposition", "disposition"),
]
block = "    // FabForge queue and offline review\n"
for method, route, handler in routes:
    block += "    app.%s((0, _urljoin[\"default\"])(_settings[\"default\"].route, 'api/fabforge/%s'), api.fabforge.%s);\n" % (method, route, handler)
route_file.write_text(source.replace(marker, block + "\n" + marker))
print("Installed six FabForge routes")

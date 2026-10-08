#!/usr/bin/env python3
"""Install narrow badge access hooks into npm CNCjs without replacing its route table."""
import sys
from pathlib import Path

root = Path(sys.argv[1])
app = root / 'server/app.js'
engine = root / 'server/services/cncengine/CNCEngine.js'
source = app.read_text()
engine_source = engine.read_text()
app_marker = '  {\n    // Register API routes with authorized access'
# Babel preserves block comments differently across versions.
if app_marker not in source:
    app_marker = '  { // Register API routes with authorized access'
engine_marker = "this.io.on('connection', function (socket) {"
if engine_marker not in engine_source:
    engine_marker = 'this.io.on("connection", function (socket) {'
if 'cncjsOperatorAccess.installRoutes' not in source and source.count(app_marker) != 1:
    raise SystemExit('Unrecognized route table; no changes made')
if 'cncjsOperatorAccess.socketGate(socket)' not in engine_source and engine_source.count(engine_marker) != 1:
    raise SystemExit('Unrecognized socket engine; no changes made')
if 'cncjsOperatorAccess.installRoutes' not in source:
    source = source.replace(app_marker, "  var cncjsOperatorAccess = require('./lib/operator-access/gateway');\n  cncjsOperatorAccess.installRoutes(app, (0, _urljoin[\"default\"])(_settings[\"default\"].route, 'api'));\n  app.use((0, _urljoin[\"default\"])(_settings[\"default\"].route, 'api'), cncjsOperatorAccess.httpGate());\n" + app_marker)
if 'cncjsOperatorAccess.socketGate(socket)' not in engine_source:
    engine_source = engine_source.replace(engine_marker, engine_marker + "\n        var cncjsOperatorAccess = require('../../lib/operator-access/gateway');\n        cncjsOperatorAccess.socketGate(socket);")
app.write_text(source)
engine.write_text(engine_source)
print('Operator HTTP and socket access hooks installed')

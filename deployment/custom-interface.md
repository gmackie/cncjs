# Shapeoko workstation interface

The fork now mounts a dedicated Shapeoko shell instead of the CNCjs Header,
Sidebar, Workspace widget grid and Settings screens. CNCjs remains the controller
backend. Normal navigation is Machine overview, Work queue, DWP611 milling,
J Tech engraving, and Machine controls. Existing /shop, /fabforge and /workspace
bookmarks remain usable; /milling and /laser are dedicated equipment workflows.

The overview combines live queue records, read-only controller telemetry and the
Pi camera. Machine illustrations are local SVG, not a live position model. Missing
telemetry is shown as unknown/disconnected. Desktop has a persistent left navigation;
tablet/phone use a horizontal navigation and responsive panels.

The DWP611 page covers the ⅛-inch collet/tool, BitSetter, work origin, manual router
switch and manual speed dial. It does not claim M3/M5 controls the router or offer
software RPM control. The J Tech page covers installation, focus/origin, review,
and separate release/start. It shows reported $30/$31/$32 read-only. Opening either
page does not change firmware mode or enable output. Laser wiring and commissioning
remain incomplete; there is deliberately no uncommissioned laser-fire button.

Machine controls use the existing authenticated CNCjs APIs/socket engine directly:

- Explicit Grbl serial connection at 115200, with a reset warning and confirmation.
- Bounded jog increments (0.1/1/10 mm) and feeds (100/300/600 mm/min).
- G54 axis zero and homing with confirmation dialogs.
- Exact released-file import/load, with local process-mode checks and server hash gates.
- Separate Start/Resume, still checked by the badge and FabForge readiness gates.
- Saved BitSetter macro inspection and the existing reviewed-content server handler.
- Always-accessible feed hold for authenticated viewers.

Manual positioning requires fresh telemetry, an authorized available resource,
Grbl readiness, Idle state and idle workflow. Reports expire after six seconds
without successful refresh. Dialogs trap keyboard focus and overlay underlying
controls. No connection, home, jog, zero, probe, start or output was sent during
UI validation. Actual commissioning must validate each motion workflow at the
machine. HTTP polling is not a physical safety interlock.

The work queue reuses the tested import/backplot/evidence services in the new shell.
Linked-file selection hides manual artifact/repository fields; selecting manual
entry still exposes those advanced fields. Badge UI is opened explicitly from the
header, keeping the observer view focused on work and machine status.

## Verification

644 tests / 28 suites passed, including new manual-control state/mode gates.
Changed JavaScript lint and production build pass. Browser validation uses the
local FabForge fixture and covers desktop/tablet layout, dedicated laser content,
queue import/backplot, observer lockout and badge transitions. Main emitted UI
assets dropped from about 3.62 MiB to 1.08 MiB after removing the mounted legacy
widget imports. Existing build asset-size warnings remain.

Deploy only the compiled `dist/cncjs/app` for this UI update. Preserve the installed
badge-access HTTP/socket hooks and server modules. Back up the current app, verify
no active machine workflow, replace assets and restart CNCjs to reload its cached
index template. Physical commissioning and badge enrollment are still pending.

# FabForge queue and G-code review

Open `/#/fabforge` from the queue icon in CNCjs. FabForge remains the source of
truth for Work Orders, Jobs, queue positions, setup sheets and validation records.
The integration targets the existing `/api/fabrication/v0` API at
`https://fab.forgegraf.com`; it requires no FabForge schema or source changes.

See [operator-access.md](operator-access.md) for viewer mode, RFID enrollment,
machine authorization, operator sessions and setup release.

## Operator workflow

1. Choose an active CNC/laser Work Order, then a Job. Jobs sort by FabForge queue
   position. Read its setup sheets, checklist and previous validations. Structured setup fields and review notes are shown directly, with missing fields marked as not specified.
2. Choose a linked file from the Job, its setup sheets, prior job-specific reviews, or Work Order references. Duplicate references are combined; references from other jobs are excluded. You can also enter a stored G-code artifact ID manually, or a repository `.nc`,
   `.gcode` or `.tap` file pinned to a full commit SHA. Matching fields in the Job's
   `sourceRef` prefill the form; other source-ref shapes require explicit selection.
3. Review top XY, front XZ and isometric backplots. Dashed amber lines are rapids;
   green lines are feed moves. Play/pause, choose 1–100× playback speed and scrub
   through the path. The cursor reports the source line, work XYZ, tool and output
   state. Playback does not connect to or write to a controller.
4. Add notes and acknowledge the review limits. Saving “Toolpath reviewed” requires
   supported code and completed playback in the UI. The server re-fetches the exact
   source and verifies its SHA-256 hash before recording evidence. A different
   hash requires a new review.
5. FabForge receives `validationType=cncjs_toolpath_review`, hash, source,
   simulator version, warnings, bounds, estimated time and notes. A successful
   offline review has `status=warning`, **not a passed physical safety gate**.
   “Changes required” records `failed`, which FabForge uses to block the work order.
6. Queue actions support retry, rework and cancellation with a reason, using
   FabForge's existing disposition rules. They do not reorder jobs, start a job,
   move the machine or claim a runner invocation. Edit queue ordering in FabForge.

Download keeps the exact reviewed bytes in a hash-named `.nc` file. Loading and
starting that file in CNCjs is a separate operator action after physical setup and
commissioning; nothing auto-starts or marks production complete.

## Supported simulation and limits

- Requires explicit G20/G21 and G90/G91 before motion; returns millimeters.
- G0/G1, G17 XY G2/G3 with incremental I/J centers, helical Z interpolation,
  G54, G91.1, G94, feed, spindle/laser and tool state, and program-end handling.
- Stops at the first unsupported or invalid block, keeping a visibly partial
  backplot. R arcs, G18/G19, probing, G53/G92/G10, canned cycles, cutter compensation,
  M6 and CNCjs expressions/macros are not simulated. No expression evaluation.
- Assumes initial work position 0,0,0. It cannot know controller offsets or actual
  starting position. Bounds are tool-center bounds; arcs are sampled at 1°.
- This is **tool-center playback**, not stock-removal or collision simulation.
  Tool geometry, material, clamps, workholding, homing, travel limits and laser
  power suitability need separate verification. The Shapeoko's saved XL Y travel
  still needs commissioning; a plotted bounding box does not validate travel.
- Time assumes constant commanded feed and 3000 mm/min rapids; acceleration,
  spindle ramp, manual pauses and laser energy delivery are not modeled.
- Files: 2 MiB, 20,000 lines, 50,000 plotted segments. Parsing runs in a separate
  worker, one simulation at a time, with a 10-second timeout and 96 MiB heap cap.

## Server configuration

Create `/home/pi/cncjs-upgrade/fabforge.env` from `fabforge.env.example`, mode 600,
owned by pi. Set URL, actual workspace UUID and a dedicated token with `read,write`
scopes. `read` permits queue/artifact inspection; `write` permits reviews and
queue disposition. Optional `FABFORGE_RESOURCE_ID` requires a matching assignment
for review or mutation; empty means CNC/laser jobs throughout that workspace.

Install a systemd drop-in:

```ini
# /etc/systemd/system/cncjs-shop.service.d/fabforge.conf
[Service]
EnvironmentFile=-/home/pi/cncjs-upgrade/fabforge.env
```

Reload systemd and restart CNCjs only when no machine workflow/commands are active.
Do not add the token to browser storage, git, command output or a public URL.
The backend holds the credential and exposes only specific integration endpoints
behind CNCjs's normal API authentication. All authenticated CNCjs operators can
use this shared workspace capability. Keep CNCjs on the trusted shop network.

The FabForge repository has `packages/api/scripts/mint-api-token.ts`; production
uses the D1 database named `fg-fabforge-production`, not the beta database.
Tokens are stored hashed in FabForge. Use dedicated names, expiry and rotation.

The bridge accepts only the configured HTTP(S) origin, fixed API paths and encoded
identifiers; it never follows redirects or fetches arbitrary source URLs. Plain
HTTP is intended for local development, HTTPS for production. Responses are size
bounded and timeout after 15 seconds. Source bytes must be valid UTF-8 text.

## Verification without hardware

```sh
node test/fixtures/fabforge/server.js
FABFORGE_URL=http://127.0.0.1:8010 \
FABFORGE_WORKSPACE_ID=fixture FABFORGE_TOKEN=fixture-only \
node bin/cncjs --host 127.0.0.1 --port 8003 --config /tmp/cncjs-ui-preview.cncrc
```

The fixture only binds localhost. It returns labeled demo data and holds review
writes in memory. Never point a production installation at it. The sample G-code
is for offline verification, not cutting.

Automated tests exercise modal coordinates, inch conversion, arcs, rejection of
unsupported blocks, worker lifecycle/concurrency, real HTTP envelope/auth handling,
redirect refusal, response limits, exact-byte preservation, source pinning,
changed-file rejection and FabForge validation/disposition payloads.

## Follow-ups

Full stock-removal/collision simulation, queue drag/reordering APIs and authenticated
job dispatch are separate features. Homing/travel, BitSetter calibration, laser
wiring/interlock and Pi power remediation remain physical commissioning tasks.

## Installed shop binding

- Host: `https://fab.forgegraf.com`
- Workspace: **Graham Mackie's workspace**, slug `graham-mackie-s-workspace`
- Workspace UUID: `f131d21d-8e70-4237-805f-a8775b0fcd8c`
- Resource: **Shapeoko 3 XL — CNCjs Pi**,
  `766aa238-048c-42e9-a175-ff959a04dc2a`
- Integration: **CNCjs queue and offline review**,
  `154464af-2fa0-4f72-b319-5a81a619ccbc`
- Resource status is `restricted`; commissioning has not been claimed complete.
- Dedicated `cncjs-shapeoko-pi` token, `read,write` scopes, expires 2027-04-06 (180 days after provisioning). Credential and metadata are backed up outside the repository.

At setup the workspace contained no Work Orders. Create a CNC/laser Work Order in
FabForge, add a Job assigned to the resource above, and use a source reference like:

```json
{ "artifactId": "your-uploaded-gcode-artifact-id" }
```

or:

```json
{ "owner": "gmacko", "repo": "parts", "path": "cam/part.nc", "ref": "FULL_40_CHARACTER_COMMIT_SHA" }
```

CNCjs can read only repositories already linked to that FabForge workspace.
Setup sheets and physical readiness checks belong to the Work Order. Queue/review
support does not make this restricted resource eligible for automatic machining.

## Deploying onto the existing npm installation

The Pi runs npm CNCjs 1.11.5 plus selected fork modules. Do **not** overwrite its
whole `dist/cncjs/server/app.js` with this fork's compiled file: the fork also
registers newer watch-file handlers absent from npm's API modules. During this
installation that mismatch was detected at startup and the original route table
was restored before applying the narrow route registration below.

Build the fork, copy `dist/cncjs/app`, `server/api/index.js`,
`server/api/api.fabforge.js` and `server/lib/fabforge` (excluding tests) into the
corresponding npm `dist/cncjs` paths. Then run:

```sh
python3 deployment/install-fabforge-routes.py   /home/pi/cncjs-upgrade/app/node_modules/cncjs/dist/cncjs/server/app.js
```

The helper is idempotent and checks the existing route-table marker. Stop CNCjs
before replacing files, preserve a backup, restart and verify both authenticated
`/api/fabforge/status` and `/api/fabforge/work-orders`, camera snapshots, and an
offline worker simulation. Full source installations already include these routes.

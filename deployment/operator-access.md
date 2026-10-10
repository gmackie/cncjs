# Badge access and machine usage

The shop installation starts in viewer mode. CNCjs login still authenticates network
access; a machine badge adds a separate, per-browser operator lease. Queue viewing,
setup sheets, offline backplots, controller status and camera viewing need no badge.
A badge unlocks reviews and queue dispositions. Release and machine commands also
require the FabForge resource to be `available`. The Shapeoko remains `restricted`
until its physical commissioning is complete.

## Reader and badge-in

Use a USB keyboard-emulation RFID reader supported by Linux, configured to type its
badge identifier followed by Enter. Match its frequency/protocol to the actual
cards (125 kHz and 13.56 MHz are not interchangeable). Plug it into the Pi running
the browser, click **Scan badge**, and scan. Reader input is confined to that field;
it is not captured from other text fields or the G-code console. Input is masked
and cleared immediately. Test the reader before enrolling production credentials.

RFID UID readers identify a card but do not cryptographically prove possession;
UIDs can be copied. This is shop accountability on a trusted network, not a
replacement for a physical interlock, emergency stop, or high-assurance access
system. Use HTTPS before sending credentials across an untrusted network.

## FabForge authorization and enrollment

Authorization belongs to the configured FabForge workspace/resource, in
`resource.policy.cncjsAccess`:

```json
{
  "version": 1,
  "grants": [{
    "operatorId": "FABFORGE_USER_ID",
    "operatorName": "Operator name",
    "badgeHash": "SHA256_OF_WORKSPACE_COLON_RESOURCE_COLON_TRIMMED_BADGE",
    "enabled": true,
    "expiresAt": "2027-01-01T00:00:00Z"
  }]
}
```

No raw badge identifiers are stored in FabForge, logs or browser storage. The
machine-specific hash avoids reusing a grant on another machine; it is not a
password-hardening mechanism. Restrict access to resource policy and D1 accordingly.
Unknown, disabled, expired or missing grants deny access. Do not invent grants or
mark commissioning complete merely to test the UI.

FabForge has no existing badge enrollment editor or resource-policy update API.
For now an authenticated administrator applies a narrowly scoped policy update to
D1. `prepare-badge-grant.py` prompts privately for the badge and prepares a mode-600
SQL file; it does not execute it. It preserves unrelated policy and refuses to
append duplicate operator IDs or badge hashes. Verify the operator's FabForge user
ID and machine training first:

```sh
python3 deployment/prepare-badge-grant.py \
  --workspace f131d21d-8e70-4237-805f-a8775b0fcd8c \
  --resource 766aa238-048c-42e9-a175-ff959a04dc2a \
  --operator ACTUAL_FABFORGE_USER_ID --name 'Operator name' \
  --expires 2027-01-01T00:00:00Z
```

Review and apply the returned SQL using the authenticated FabForge administrator's
`wrangler d1 execute fg-fabforge-production --remote --file PATH`. Confirm
`grants_added = 1`, then remove the temporary SQL file. To revoke a grant, set that
grant's `enabled` to false in the same resource policy. Enrollment/revocation UI
and managed qualification records are follow-up work in FabForge; this fork does
not provide those screens.

## Sessions and release

Only one operator lease can own the machine. Other browsers remain viewers. A
random capability is kept in that browser tab's session storage and sent in an HTTP
header or WebSocket binding, never in URLs. The server rechecks the resource grant
at most every 15 seconds on access. A failed check locks controls; there is no
offline authorization fallback. Restarting CNCjs invalidates all leases. Badge-out,
15 minutes without an operator action, eight hours maximum, or grant expiry ends
the session. Watching status/queue updates does not extend the lease.

1. Badge in, select the job and import its linked G-code.
2. Play the backplot and acknowledge its limits.
3. **Release for setup** requires a ready Work Order, queued Job assigned to this
   resource, supported G-code and an available machine. It writes warning-level
   `cncjs_setup_release` evidence to FabForge with operator/session identity and
   exact file hash, then binds the local release to the operator session.
4. Download and load the exact reviewed bytes. Server checks prevent loading or
   starting a different file through the normal G-code upload/start paths.
5. Verify physical setup and start separately. Badge-in/release never starts a
   runner invocation or sends machine commands. Release is not a passed safety
   gate and does not mark the Work Order or Job running/complete.

Manual controls remain available to authorized operators on available machines;
they are not restricted to a released toolpath. Machine configuration, shell
commands, arbitrary file writes, raw macro loading and account administration are
blocked in badge mode even for an operator. Use an administrator maintenance window
for these tasks. Feed hold is available to authenticated viewers and applies only
to already-open Grbl controllers. It is not an emergency stop. Session expiry or
badge-out does not itself interrupt a running program or send a reset; it locks
further controls, and feed hold remains available.

## Usage records

The server appends session start/end, release, API action and machine-action records
to `~/.cncjs-usage.jsonl` (mode 600), or `CNCJS_USAGE_LOG`. Events carry timestamp,
operator ID, random session ID, resource ID and relevant job/hash. Raw badge values,
capability tokens and raw command payloads are omitted. Session-end events include
elapsed session time; this measures access time, **not verified cutting time**.
Abrupt power loss can leave a start event without an end. Back up/rotate the log
with the Pi's operational records. Failure to write an audit event denies the
associated new session/action. FabForge stores setup-release evidence; UUID usage records can also synchronize
to FabForge when upload is enabled. Usage charts and physical runtime reconciliation
are follow-ups, not implemented billing or attendance records.

## Deployment and rollback

Badge mode is on by default. `CNCJS_BADGE_ACCESS=0` is an explicit legacy/maintenance
bypass, controlled only by the server administrator; never expose it in the UI.
Build the fork and install `app` and `server/lib/operator-access` (excluding tests).
For the existing npm installation, run `install-operator-access.py` against its
`dist/cncjs` directory to add the HTTP and WebSocket hooks. Do not replace the whole
npm route table or engine. Back up both files and UI first, deploy only with no
active workflow, restart CNCjs, and verify a viewer's HTTP/socket command attempts
are denied. Do not probe a real serial port as an authorization test.

Until a real badge is enrolled and commissioning is completed, the shop is a viewer
with no production operator access. This is intentional. To roll back, restore the
UI, route table and socket engine from the pre-badge archive and restart while idle.

## Machine administration and usage upload

FabForge provides `/machines` for workspace owners/admins to enroll,
replace and revoke member badges. Enrollment requires a masked scan, expiry within
one year, and explicit machine-training confirmation. The Pi token cannot administer
grants. This replaces the SQL helper once the companion release is deployed.

The CNCjs **Operator usage** page (`/#/usage`) shows the latest 200 journal events
and summed ended-session access time. Commands are requests logged before controller
execution, not proof of successful machining. Missing session-end events can mean
an active session or an interrupted process. This is not a cutting-time report.

New journal events receive persistent UUIDs and workspace/resource binding. Set
`CNCJS_USAGE_SYNC=1` in the service environment only after deploying FabForge's usage
API and `0004_machine_usage.sql`. A 30-second loop sends at most 100 events per batch
and advances a private atomic cursor only after acknowledgement. Retries use the
same IDs, so FabForge deduplicates them. Upload outages never discard local events
or unlock controls. The usage page shows pending errors and last successful check.
Old events without UUIDs stay local; they are not automatically backfilled.

Retain the journal together with `.fabforge-cursor.json`. Rotation, truncation or
changing the FabForge binding stops uploads with a visible error; reconcile/archive
the old journal and cursor before starting a new pair. Do not delete pending logs
to clear an upload error. The bridge sends only allowlisted metadata, not raw badge
IDs, capability tokens, source payloads or raw G-code.

### Production rollout, 2026-10-08

FabForge machine administration and usage ingestion are deployed, and the production
usage migration is applied. Upload is enabled on the Pi. The live journal currently
has no events, so a genuine upload remains to be verified after operator use.
Viewer restrictions, empty controller list, queue access, active services and
unchanged machine configuration were checked after the idle service restart.
The camera returns real but dark frames; check lighting and mounting on site.
Machine restriction, real badge enrollment and physical commissioning remain pending.

### Usage status reliability

The usage page distinguishes local journal checks from acknowledged uploads.
It reports unprocessed journal bytes, the last acknowledged upload and the number
of records acknowledged during this service process. These counters reset on
restart; the durable cursor still prevents re-uploading acknowledged records.
An empty machine reports readiness without claiming a hosted connectivity check.
A missing journal with an existing cursor raises an error instead of retaining
a stale healthy state. Restore the journal/cursor pair before continuing.

Verified with 671 passing tests, a production UI build, and a localhost badge
session whose event was acknowledged by the fixture with zero pending bytes.
Production remains restricted; no synthetic production events were created.

## Supervised commissioning on a restricted machine

A machine administrator may grant `commissioning: true` on a machine-specific
badge grant. Temporary typed setup codes must also use `commissioningOnly: true`
and a short expiry. These flags are read from FabForge on badge-in and revalidated
with the normal lease. The latter flag denies all production actions even if the
resource later becomes available. Revocation uses the normal disabled/expired grant.
Do not re-enroll this temporary badge through the generic enrollment form: that
form does not preserve these commissioning flags. Replace it with a real operator
badge only after qualification and commissioning are complete.

Configure `CNCJS_COMMISSIONING_PORT` to the exact stable `/dev/serial/by-id/...`
path. Open **Commissioning**, badge in (a typed enrolled code works without RFID),
confirm tool-power isolation and clearance, and begin a 30-minute setup session.
Connect and Home are separate deliberate actions. Homing must be observed complete
in this connection before jog or position capture is accepted. Restart/reset/alarm
invalidates the reference. Keep the browser/backend connection open while aligning;
there is no automatic connection or homing on page load.

XY steps are 0.1, 1 or 10 mm at 100, 300 or 600 mm/min. Z steps are at most 1 mm at
100 mm/min. Each click is one move; subsequent requests wait for completion. Server
checks require fresh Grbl status, idle workflow, no loaded job/queued feeder work,
milling mode and inactive probe/limit inputs (homing allows asserted limit inputs).
Positive moves stop short of the home switches; negative travel remains physically
unverified and must be supervised. These are incremental positioning controls, not
calibrated soft limits. Cancel jog does not cancel homing; use the physical stop for
an unsafe homing move. Feed hold remains available to viewers.

Align over the actual **front-left BitSetter** and capture its candidate position.
The journal records machine coordinates without applying offsets or enabling any
probe cycle. It remains unverified until clearance, bounded probing and repeatability
are checked. Job Start, raw G-code, macros, work-zero changes, spindle and laser output
are not part of this setup surface. End setup/badge out when finished.

#!/usr/bin/env python3
"""Prepare a machine-specific FabForge grant for an administrator to apply to D1.
Reads the badge privately. Never runs SQL or enrolls a badge automatically.
"""
import argparse
import datetime
import getpass
import hashlib
import json
import os
import tempfile

parser = argparse.ArgumentParser()
parser.add_argument('--workspace', required=True)
parser.add_argument('--resource', required=True)
parser.add_argument('--operator', required=True, help='FabForge user ID')
parser.add_argument('--name', required=True)
parser.add_argument('--expires', required=True, help='UTC ISO date/time, e.g. 2027-01-01T00:00:00Z')
args = parser.parse_args()
expiry = datetime.datetime.fromisoformat(args.expires.replace('Z', '+00:00'))
if expiry.tzinfo is None or expiry <= datetime.datetime.now(datetime.timezone.utc):
    parser.error('Expiry must be a future date/time with a timezone')
badge = getpass.getpass('Scan badge, then Enter (input hidden): ').strip()
if not 4 <= len(badge) <= 128 or not all(33 <= ord(c) <= 126 for c in badge):
    parser.error('Expected 4–128 printable ASCII characters with no spaces')
grant = dict(operatorId=args.operator, operatorName=args.name, enabled=True,
             expiresAt=args.expires, badgeHash=hashlib.sha256(f'{args.workspace}:{args.resource}:{badge}'.encode()).hexdigest())
quote = lambda s: "'" + s.replace("'", "''") + "'"
# Append preserves existing machine policy/grants. Enroll only after checking duplicates.
sql = f"""UPDATE fab_resources
SET policy = json_set(COALESCE(policy, '{{}}'),
  '$.cncjsAccess.version', 1,
  '$.cncjsAccess.grants', json_insert(COALESCE(json_extract(policy, '$.cncjsAccess.grants'), '[]'), '$[#]', json({quote(json.dumps(grant))}))),
  updated_at = unixepoch() * 1000
WHERE id = {quote(args.resource)} AND workspace_id = {quote(args.workspace)}
AND NOT EXISTS (SELECT 1 FROM json_each(COALESCE(json_extract(policy, '$.cncjsAccess.grants'), '[]'))
  WHERE json_extract(value, '$.badgeHash') = {quote(grant['badgeHash'])}
     OR json_extract(value, '$.operatorId') = {quote(args.operator)});
SELECT changes() AS grants_added;
"""
fd, filename = tempfile.mkstemp(prefix='fabforge-badge-', suffix='.sql')
with os.fdopen(fd, 'w') as f:
    f.write(sql)
print(f'Prepared private SQL file: {filename}')
print('Review this grant and existing enrollments before applying it with an authenticated FabForge administrator.')
print(f'wrangler d1 execute fg-fabforge-production --remote --file {filename}')

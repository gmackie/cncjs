/* eslint-env jest */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createUsageSync, recentUsage } from '../usage';

let directory;
beforeEach(() => {
 directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cncjs-usage-'));
});
afterEach(() => {
 fs.rmSync(directory, { recursive: true, force: true });
});
const event = { eventId: 'f3c577fa-4597-47cb-b09b-8d1bf447ed81', type: 'session_started', at: '2026-10-08T12:00:00Z', workspaceId: 'w', resourceId: 'r', operatorId: 'o' };
const setup = () => {
  const file = path.join(directory, 'usage.jsonl');
  const remote = jest.fn().mockResolvedValue({ accepted: [event.eventId] });
  const sync = createUsageSync({ file: () => file, remote, enabled: () => true, config: () => ({ url: 'https://fab.test', workspaceId: 'w', resourceId: 'r' }) });
  return { file, remote, sync };
};
test('uploads only allowlisted fields and advances an atomic persistent cursor', async () => {
  const { file, remote, sync } = setup();
  fs.writeFileSync(file, JSON.stringify({ ...event, token: 'secret', source: { arbitrary: true } }) + '\n');
  await sync.sync();
  expect(remote).toHaveBeenCalledWith('resources/r/usage', { method: 'POST', body: { events: [{ eventId: event.eventId, type: event.type, at: event.at, operatorId: 'o' }] } });
  await sync.sync();
  expect(remote).toHaveBeenCalledTimes(1);
  expect(sync.status().lastSuccess).toBeTruthy();
  expect(recentUsage(file).events[0].token).toBeUndefined();
});
test('outage and incomplete acknowledgement retain pending data for retry', async () => {
  const { file, remote, sync } = setup();
  fs.writeFileSync(file, JSON.stringify(event) + '\n');
  remote.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ accepted: [] });
  await sync.sync();
  expect(sync.status().error).toBe('offline');
  expect(fs.existsSync(file + '.fabforge-cursor.json')).toBe(false);
  await sync.sync();
  expect(fs.existsSync(file + '.fabforge-cursor.json')).toBe(false);
  await sync.sync();
  expect(remote).toHaveBeenCalledTimes(3);
});
test('skips legacy/unrelated events and waits for newline on incomplete append', async () => {
  const { file, remote, sync } = setup();
  fs.writeFileSync(file, JSON.stringify({ type: 'legacy' }) + '\n' + JSON.stringify({ ...event, resourceId: 'other' }) + '\n' + JSON.stringify(event));
  await sync.sync(); expect(remote).not.toHaveBeenCalled();
  fs.appendFileSync(file, '\n');
  await sync.sync(); expect(remote).toHaveBeenCalledTimes(1);
});
test('rotation and rebinding are surfaced instead of silently losing records', async () => {
  const { file, sync } = setup();
  fs.writeFileSync(file, JSON.stringify(event) + '\n');
  await sync.sync(); fs.writeFileSync(file, '');
  await sync.sync(); expect(sync.status().error).toMatch(/rotated/);
  const other = createUsageSync({ file: () => file, enabled: () => true, config: () => ({ url: 'https://new.test', workspaceId: 'w', resourceId: 'r' }) });
  await other.sync(); expect(other.status().error).toMatch(/binding changed/);
});
test('bounds recent history and strips incomplete final records', () => {
  const { file } = setup(); fs.writeFileSync(file, (JSON.stringify(event) + '\n').repeat(250) + '{');
  expect(recentUsage(file).events).toHaveLength(200);
  expect(recentUsage(file).truncated).toBe(true);
});

test('empty machines report a local check without claiming a remote upload', async () => {
  const { sync, remote } = setup();
  await sync.sync();
  expect(sync.status()).toMatchObject({ journalPresent: false, lastUpload: null, uploadedEvents: 0, pendingBytes: 0, error: '' });
  expect(sync.status().lastChecked).toBeTruthy();
  expect(remote).not.toHaveBeenCalled();
});
test('a missing journal with an existing cursor cannot appear healthy', async () => {
  const { file, sync } = setup();
  fs.writeFileSync(file, JSON.stringify(event) + '\n');
  await sync.sync();
  fs.unlinkSync(file);
  await sync.sync();
  expect(sync.status().error).toMatch(/journal is missing/);
  expect(sync.status().journalPresent).toBe(false);
  expect(fs.existsSync(file + '.fabforge-cursor.json')).toBe(true);
});
test('reports remaining bytes across batches and does not count failed uploads', async () => {
  const { file, sync, remote } = setup();
  fs.writeFileSync(file, (JSON.stringify(event) + '\n').repeat(101));
  remote.mockRejectedValueOnce(new Error('offline'));
  await sync.sync();
  expect(sync.status().uploadedEvents).toBe(0);
  expect(sync.status().pendingBytes).toBe(fs.statSync(file).size);
  await sync.sync();
  expect(sync.status().uploadedEvents).toBe(100);
  expect(sync.status().pendingBytes).toBeGreaterThan(0);
  await sync.sync();
  expect(sync.status().uploadedEvents).toBe(101);
  expect(sync.status().pendingBytes).toBe(0);
  const lastUpload = sync.status().lastUpload;
  await sync.sync();
  expect(sync.status().lastUpload).toBe(lastUpload);
  expect(remote).toHaveBeenCalledTimes(3);
});

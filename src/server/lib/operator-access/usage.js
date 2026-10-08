import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { configuration, request, segment } from '../fabforge/client';

export const usageFile = () => process.env.CNCJS_USAGE_LOG || path.join(os.homedir(), '.cncjs-usage.jsonl');
const keys = ['eventId', 'type', 'at', 'operatorId', 'sessionId', 'durationMs', 'reason', 'jobId', 'workOrderId', 'sha256', 'action', 'command'];
const clean = event => keys.reduce((result, key) => {
  if (event[key] !== undefined) {
 result[key] = event[key];
}
  return result;
}, {});
export const appendUsage = event => fs.appendFileSync(usageFile(), JSON.stringify({ ...event, eventId: crypto.randomUUID(), workspaceId: configuration().workspaceId }) + '\n', { mode: 0o600 });

// Bounded reads keep the Pi journal from blocking the controller event loop.
export const recentUsage = (file = usageFile()) => {
  if (!fs.existsSync(file)) {
 return { events: [], truncated: false };
}
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const start = Math.max(0, size - 256 * 1024);
    const bytes = Buffer.alloc(size - start);
    fs.readSync(fd, bytes, 0, bytes.length, start);
    const lines = bytes.toString('utf8').split('\n');
    if (start) {
 lines.shift();
}
    lines.pop(); // Never parse a partially appended record.
    const events = lines.filter(Boolean).map(line => clean(JSON.parse(line)));
    return { events: events.slice(-200).reverse(), truncated: start > 0 || events.length > 200 };
  } finally {
 fs.closeSync(fd);
}
};
export const createUsageSync = ({ file = usageFile, remote = request, config = configuration, enabled = () => process.env.CNCJS_USAGE_SYNC === '1' } = {}) => {
  let running = false;
  let state = { lastSuccess: null, error: '', enabled: false };
  return {
    status: () => ({ ...state, enabled: enabled() }),
    async sync() {
      if (running || !enabled()) {
 return;
}
      running = true;
      try {
        const filename = file();
        if (!fs.existsSync(filename)) {
 return;
}
        const { url, workspaceId, resourceId } = config();
        if (!url || !workspaceId || !resourceId) {
 throw new Error('Configure FabForge machine binding before synchronizing usage.');
}
        const binding = `${url}:${workspaceId}:${resourceId}`;
        const cursorFile = filename + '.fabforge-cursor.json';
        const cursor = fs.existsSync(cursorFile) ? JSON.parse(fs.readFileSync(cursorFile, 'utf8')) : { offset: 0, binding };
        if (cursor.binding !== binding) {
 throw new Error('Usage binding changed. Administrator review is required before synchronization.');
}
        const fd = fs.openSync(filename, 'r');
        let position = cursor.offset;
        let stat;
        const events = [];
        try {
          stat = fs.fstatSync(fd);
          if (!Number.isSafeInteger(position) || position < 0) {
 throw new Error('Invalid usage cursor.');
}
          if ((cursor.ino && cursor.ino !== stat.ino) || stat.size < position) {
 throw new Error('Usage journal rotated. Retain the old file and reconcile its cursor before continuing.');
}
          const bytes = Buffer.alloc(Math.min(256 * 1024, stat.size - position));
          fs.readSync(fd, bytes, 0, bytes.length, position);
          let start = 0;
          for (let end = bytes.indexOf(10); end !== -1 && events.length < 100; end = bytes.indexOf(10, start)) {
            const event = JSON.parse(bytes.subarray(start, end).toString('utf8'));
            if (event.eventId && event.workspaceId === workspaceId && event.resourceId === resourceId) {
 events.push(clean(event));
}
            position += end - start + 1;
            start = end + 1;
          }
          if (position === cursor.offset && bytes.length === 256 * 1024) {
 throw new Error('Oversized usage journal record.');
}
        } finally {
 fs.closeSync(fd);
}
        if (events.length) {
          const result = await remote(`resources/${segment(resourceId)}/usage`, { method: 'POST', body: { events } });
          if (!result || !Array.isArray(result.accepted) || !events.every(event => result.accepted.includes(event.eventId))) {
 throw new Error('FabForge did not acknowledge the complete usage batch.');
}
        }
        fs.writeFileSync(cursorFile + '.tmp', JSON.stringify({ binding, offset: position, ino: stat.ino }), { mode: 0o600 });
        fs.renameSync(cursorFile + '.tmp', cursorFile);
        state = { enabled: true, lastSuccess: new Date().toISOString(), error: '' };
      } catch (err) {
        state = { ...state, error: err.message };
      } finally {
 running = false;
}
    }
  };
};
export const usageSync = createUsageSync();

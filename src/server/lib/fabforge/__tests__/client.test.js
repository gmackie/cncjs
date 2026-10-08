/* eslint-env jest */
import http from 'http';
import { request } from '../client';

let server;
let origin;
let respond;
let seen;
const previous = { ...process.env };
beforeAll(async () => {
  server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      seen = {
        url: req.url,
        method: req.method,
        token: req.headers.authorization,
        body: Buffer.concat(chunks).toString()
      };
      respond(req, res);
    });
  });
  await new Promise((resolve) => {
 server.listen(0, '127.0.0.1', resolve);
});
  origin = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(() => {
  process.env.FABFORGE_URL = origin;
  process.env.FABFORGE_WORKSPACE_ID = 'shop';
  process.env.FABFORGE_TOKEN = 'test-token';
  respond = (req, res) => res.end(JSON.stringify({ data: { workOrders: [] } }));
});
afterAll(async () => {
  process.env = previous;
  await new Promise((resolve) => {
 server.close(resolve);
});
});
test('sends server credential and workspace using the real HTTP contract', async () => {
  expect(await request('work-orders')).toEqual({ workOrders: [] });
  expect(seen).toMatchObject({ url: '/api/fabrication/v0/work-orders?workspaceId=shop', token: 'Bearer test-token' });
  await request('work-orders/w1/validations', { method: 'POST', body: { workspaceId: 'other', status: 'warning' } });
  expect(JSON.parse(seen.body)).toEqual({ workspaceId: 'shop', status: 'warning' });
});
test('never follows redirects or leaks upstream error bodies', async () => {
  respond = (req, res) => {
    res.writeHead(302, { Location: 'http://elsewhere' });
    res.end('secret');
  };
  await expect(request('work-orders')).rejects.toThrow('HTTP 302');
  respond = (req, res) => {
    res.writeHead(401);
    res.end('private upstream detail');
  };
  await expect(request('work-orders')).rejects.toThrow('HTTP 401');
});
test('bounds payloads and checks envelopes', async () => {
  respond = (req, res) => res.end('invalid');
  await expect(request('work-orders')).rejects.toThrow('invalid API');
  respond = (req, res) => res.end('x'.repeat(2 * 1024 * 1024 + 1));
  await expect(request('artifacts/a1', { raw: true })).rejects.toThrow('2 MiB');
});
test('rejects invalid UTF-8 and accepts exact text', async () => {
  respond = (req, res) => res.end(Buffer.from([0xff]));
  await expect(request('artifacts/a1', { raw: true })).rejects.toThrow('UTF-8');
  respond = (req, res) => res.end('G21 G90\r\nG0 X1\n');
  expect(await request('artifacts/a1', { raw: true })).toBe('G21 G90\r\nG0 X1\n');
});
test('rejects unconfigured and credential-bearing base URLs', async () => {
  process.env.FABFORGE_TOKEN = '';
  await expect(request('work-orders')).rejects.toThrow('Configure');
  process.env.FABFORGE_TOKEN = 'test';
  process.env.FABFORGE_URL = 'http://user:pass@localhost';
  await expect(request('work-orders')).rejects.toThrow('Invalid FabForge');
});

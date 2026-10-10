/* eslint-env jest */
import { kioskEnabled, localKioskRequest, kioskGuard } from '../lib/kiosk';
import { validateUser } from '../access-control';
import { socketGate, httpGate } from '../lib/operator-access/gateway';

const request = (address = '127.0.0.1', host = '127.0.0.1:8000', origin) => ({ socket: { remoteAddress: address }, get: key => ({ host, origin }[key]) });
const original = { kiosk: process.env.CNCJS_KIOSK, badge: process.env.CNCJS_BADGE_ACCESS };
beforeEach(() => {
  process.env.CNCJS_KIOSK = '1';
  process.env.CNCJS_BADGE_ACCESS = '1';
});
afterAll(() => {
  for (const [key, value] of Object.entries({ CNCJS_KIOSK: original.kiosk, CNCJS_BADGE_ACCESS: original.badge })) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});
test('local kiosk requires literal loopback host and same origin', () => {
  expect(localKioskRequest(request())).toBe(true);
  expect(localKioskRequest(request('::1', '[::1]:8000', 'http://[::1]:8000'))).toBe(true);
  expect(localKioskRequest(request('::ffff:127.0.0.1'))).toBe(true);
  expect(localKioskRequest(request('192.168.68.1'))).toBe(false);
  expect(localKioskRequest(request('127.0.0.1', 'rebound.example:8000'))).toBe(false);
  expect(localKioskRequest(request('127.0.0.1', '127.0.0.1:8000', 'http://evil.example'))).toBe(false);
  expect(localKioskRequest({ ...request('192.168.68.1'), ip: '127.0.0.1' })).toBe(false);
});
test('kiosk identity cannot outlive badge protection or kiosk enablement', async () => {
  await expect(validateUser({ role: 'kiosk' })).resolves.toBeUndefined();
  process.env.CNCJS_BADGE_ACCESS = '0';
  expect(kioskEnabled()).toBe(false);
  expect(localKioskRequest(request())).toBe(false);
  await expect(validateUser({ role: 'kiosk' })).rejects.toThrow('disabled');
  const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
  const next = jest.fn();
  kioskGuard({ ...request(), user: { role: 'kiosk' } }, res, next);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});
test('remote replay of kiosk bearer is denied but normal users are unchanged', () => {
  const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
  const next = jest.fn();
  kioskGuard({ ...request('192.168.68.1'), user: { role: 'kiosk' } }, res, next);
  expect(next).not.toHaveBeenCalled();
  kioskGuard({ ...request('192.168.68.1'), user: { id: 'existing-user' } }, res, next);
  expect(next).toHaveBeenCalledTimes(1);
});
test('existing kiosk sockets fail closed when badge mode is switched off', async () => {
  let gate;
  const socket = { decoded_token: { role: 'kiosk' },
on: jest.fn(),
emit: jest.fn(),
use: fn => {
 gate = fn;
} };
  socketGate(socket, { enabled: () => false });
  const next = jest.fn();
  await gate(['command', 'port', 'gcode', 'M3'], next);
  expect(next).not.toHaveBeenCalled();
  expect(socket.emit).toHaveBeenCalledWith('operator:denied', expect.anything());
});
test('kiosk viewer cannot use badge mode to access account administration', async () => {
  const next = jest.fn();
  const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
  await httpGate({ enabled: () => true })({ method: 'GET', path: '/users', user: { role: 'kiosk' } }, res, next);
  expect(res.status).toHaveBeenCalledWith(403);
  expect(next).not.toHaveBeenCalled();
});

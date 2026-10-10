import crypto from 'crypto';
import store from '../../../store';
/* eslint-env jest */
import { httpGate, socketGate, checkLoadedFile } from '../gateway';

const service = () => ({
  enabled: () => true,
  requireOperator: jest.fn().mockRejectedValue(new Error('Badge required')),
  record: jest.fn(),
  status: jest.fn(() => ({ authorized: false })),
});
const response = () => {
  const res = { status: jest.fn(), send: jest.fn() };
  res.status.mockReturnValue(res);
  return res;
};
test.each([
  ['POST', '/gcode'],
  ['POST', '/commands/run/id'],
  ['PUT', '/users/id'],
  ['POST', '/state'],
  ['PUT', '/watch/file'],
  ['POST', '/fabforge/work-orders/o/jobs/j/disposition'],
])('viewer HTTP bypass denied: %s %s', async (method, path) => {
  const next = jest.fn();
  const res = response();
  await httpGate(service())(
    { method, path, get: () => '', body: {} },
    res,
    next
  );
  expect(next).not.toHaveBeenCalled();
  expect(res.status).toHaveBeenCalled();
});
test.each([
  ['GET', '/controllers'],
  ['GET', '/fabforge/work-orders/o'],
  ['POST', '/fabforge/work-orders/o/jobs/j/review'],
])('read-only viewer endpoint allowed: %s %s', async (method, path) => {
  const next = jest.fn();
  await httpGate(service())({ method, path }, response(), next);
  expect(next).toHaveBeenCalled();
});
test('badge is never an administrative credential', async () => {
  const auth = service();
  auth.requireOperator.mockResolvedValue({});
  const next = jest.fn();
  await httpGate(auth)(
    { method: 'POST', path: '/commands/run/id' },
    response(),
    next
  );
  expect(next).not.toHaveBeenCalled();
});
test('exact bytes must match release for upload/start', () => {
  const gcode = 'G21 G90\nG0 X1\n';
  const session = {
    release: {
      sha256: crypto.createHash('sha256').update(gcode).digest('hex'),
    },
  };
  expect(() => checkLoadedFile(session, gcode)).not.toThrow();
  expect(() => checkLoadedFile(session, gcode + 'M3')).toThrow('exact G-code');
  expect(() => checkLoadedFile(null, gcode)).toThrow('exact G-code');
});
test.each(['open', 'close', 'command', 'write', 'writeln'])(
  'viewer socket event denied: %s',
  async (event) => {
    let gate;
    const socket = {
      on: jest.fn(),
      emit: jest.fn(),
      use: (fn) => {
        gate = fn;
      },
    };
    socketGate(socket, service());
    const next = jest.fn();
    await gate([event, '/dev/not-a-real-port', 'gcode:start'], next);
    expect(next).not.toHaveBeenCalled();
    expect(socket.emit).toHaveBeenCalledWith(
      'operator:denied',
      expect.anything()
    );
  }
);
test('authorized socket still cannot use file-writing commands', async () => {
  let gate;
  const auth = service();
  auth.requireOperator.mockResolvedValue({});
  const socket = {
    on: jest.fn(),
    emit: jest.fn(),
    use: (fn) => {
      gate = fn;
    },
  };
  socketGate(socket, auth);
  const next = jest.fn();
  await gate(
    ['command', '/dev/not-a-real-port', 'autolevel:saveToFile', '/tmp/no'],
    next
  );
  expect(next).not.toHaveBeenCalled();
});
test('serial listing is read only and remains available', async () => {
  let gate;
  const socket = {
    on: jest.fn(),
    emit: jest.fn(),
    use: (fn) => {
      gate = fn;
    },
  };
  socketGate(socket, service());
  const next = jest.fn();
  await gate(['list'], next);
  expect(next).toHaveBeenCalled();
});

test.each(['blocked', 'cancelled', 'wrong-machine', 'ready'])('start revalidates released job: %s', async state => {
  let gate;
  const gcode = 'G21 G90\nG0 X1\n';
  const auth = service();
  auth.requireOperator.mockResolvedValue({ release: { workOrderId: 'o', jobId: 'j', sha256: crypto.createHash('sha256').update(gcode).digest('hex') } });
  const remote = { detail: jest.fn().mockResolvedValue({ workOrder: { status: state === 'blocked' ? 'blocked' : 'ready' }, jobs: [{ id: 'j', status: state === 'cancelled' ? 'cancelled' : 'queued', resourceId: state === 'wrong-machine' ? 'other' : 'machine' }] }) };
  const socket = { on: jest.fn(),
emit: jest.fn(),
use: fn => {
 gate = fn;
} };
  store.set('controllers.TEST_ONLY', { sender: { state: { gcode } } });
  try {
    socketGate(socket, auth, remote, () => ({ resourceId: 'machine' }));
    const next = jest.fn();
    await gate(['command', 'TEST_ONLY', 'gcode:start'], next);
    expect(next).toHaveBeenCalledTimes(state === 'ready' ? 1 : 0);
  } finally {
 store.unset('controllers.TEST_ONLY');
}
});

/* eslint-env jest */
import { EventEmitter } from 'events';
import crypto from 'crypto';
import { createMachineMonitor } from '../machine-monitor';

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const fixture = () => {
  let time = 100000;
  const controller = {
    type: 'Grbl',
isOpen: jest.fn(() => true),
    runner: new EventEmitter(),
workflow: { state: 'idle' },
    sender: { state: { gcode: 'G0 X0', total: 1, received: 0 } },
  };
  controller.runner.state = { status: { activeState: 'Idle' } };
  const lease = { operatorId: 'operator', release: { workOrderId: 'wo', jobId: 'job', sha256: hash('G0 X0'), releasedAt: new Date(time).toISOString() } };
  const remote = jest.fn(() => Promise.resolve({ accepted: true }));
  const monitor = createMachineMonitor({ controllers: () => [controller], operator: () => lease, remote, config: () => ({ resourceId: 'machine' }), enabled: () => true, now: () => time });
  return { controller,
lease,
remote,
monitor,
tick: () => {
 time += 11000;
} };
};
test('reports no controller without connecting or fabricating a run', () => {
  const monitor = createMachineMonitor({ controllers: () => [], operator: () => ({ operatorId: null, release: null }) });
  expect(monitor.snapshot()).toMatchObject({ controller: { connected: false, telemetryFresh: false, state: 'Unknown' }, loadedJob: null });
});
test('requires fresh received status and expires cached telemetry', () => {
  const { monitor, controller, tick } = fixture();
  expect(monitor.snapshot().controller.telemetryFresh).toBe(false);
  controller.runner.emit('status');
  expect(monitor.snapshot().controller.state).toBe('Idle');
  tick();
  expect(monitor.snapshot().controller.state).toBe('Unknown');
  expect(controller.runner.listenerCount('status')).toBe(1);
});
test('tracks only hash-matched jobs, retaining identity after badge-out until file change', () => {
  const { monitor, lease, controller } = fixture();
  expect(monitor.snapshot().loadedJob.jobId).toBe('job');
  lease.release = null;
  expect(monitor.snapshot().loadedJob.jobId).toBe('job');
  controller.sender.state.gcode = 'G0 X1';
  expect(monitor.snapshot().loadedJob).toBe(null);
});
test('uploads only metadata, reports failure and recovers', async () => {
  const { monitor, remote } = fixture();
  remote.mockRejectedValueOnce(new Error('offline'));
  await monitor.sync();
  expect(monitor.status().error).toBe('offline');
  await monitor.sync();
  expect(monitor.status().error).toBe('');
  expect(remote.mock.calls[1][0]).toBe('resources/machine/monitor');
  expect(JSON.stringify(remote.mock.calls[1][1])).not.toContain('G0 X0');
});
test('does not overlap reports or run when disabled', async () => {
  const { monitor, remote } = fixture();
  let finish;
  remote.mockImplementation(() => new Promise(resolve => {
 finish = resolve;
}));
  const first = monitor.sync();
  await monitor.sync();
  expect(remote).toHaveBeenCalledTimes(1);
  finish({ accepted: true });
  await first;
  const disabled = createMachineMonitor({ enabled: () => false, remote });
  await disabled.sync();
  expect(remote).toHaveBeenCalledTimes(1);
});

/* eslint-env jest */
import { EventEmitter } from 'events';
import { createCommissioning } from '../commissioning';

const setup = () => {
  const report = { activeState: 'Idle', spindle: 0, pinState: '', mpos: { x: '-3', y: '-3', z: '-3' } };
  const controller = { options: { port: '/fixture' }, type: 'Grbl', isOpen: () => true, runner: new EventEmitter(), write: jest.fn(), writeln: jest.fn(), status: { ready: true, statusAgeMs: 0, workflow: { state: 'idle' }, feeder: { queue: 0 }, sender: { total: 0 }, controller: { state: { status: report }, settings: { settings: { $13: '0', $32: '0' } } } } };
  const access = { requireCommissioning: jest.fn().mockResolvedValue({}), record: jest.fn() };
  const service = createCommissioning({ controllers: () => ({ '/fixture': controller }), access, port: () => '/fixture' });
  const home = async () => {
    await service.act('token', { action: 'home', ready: true });
    controller.runner.emit('status', { activeState: 'Home' });
    controller.runner.emit('ok');
    controller.runner.emit('status', report);
  };
  return { controller, report, access, service, home };
};
test('commissioning needs authorization and exact configured port', async () => {
  const { service, access, controller } = setup();
  await expect(service.open('token', '/other', { controllerType: 'Grbl', baudrate: 115200, ready: true })).rejects.toThrow('configured');
  access.requireCommissioning.mockRejectedValue(new Error('denied'));
  await expect(service.act('token', { action: 'home', ready: true })).rejects.toThrow('denied');
  expect(controller.writeln).not.toHaveBeenCalled();
});
test('home must be observed complete before a jog; duplicate clicks cannot queue', async () => {
  const { service, controller, home, report } = setup();
  const jog = { action: 'jog', axis: 'X', distance: -10, feed: 100 };
  await expect(service.act('token', jog)).rejects.toThrow('Home first');
  await home();
  await service.act('token', jog);
  expect(controller.writeln).toHaveBeenLastCalledWith('$J=G91 G21 X-10 F100');
  await expect(service.act('token', jog)).rejects.toThrow('finish');
  controller.runner.emit('ok');
  controller.runner.emit('status', report);
  expect(service.status().pending).toBe('jog');
  report.mpos.x = '-13';
  controller.runner.emit('status', report);
  expect(service.status().pending).toBeNull();
  await service.act('token', { action: 'capture' });
  expect(service.status().candidate.position).toEqual({ x: -13, y: -3, z: -3 });
  controller.runner.emit('startup');
  expect(service.status().homed).toBe(false);
  expect(service.status().candidate).toBeNull();
});
test.each([
  { action: 'jog', axis: 'X\nM3', distance: 1, feed: 100 },
  { action: 'jog', axis: 'X', distance: 50, feed: 100 },
  { action: 'jog', axis: 'Z', distance: -10, feed: 100 },
  { action: 'jog', axis: 'Z', distance: -1, feed: 600 },
  { action: 'jog', axis: 'X', distance: 10, feed: 100 },
  { action: 'gcode', gcode: 'M3' },
  { action: 'start' },
])('rejects unsafe or unsupported setup input %j', async input => {
  const { service, controller, home } = setup();
  await home(); controller.writeln.mockClear();
  await expect(service.act('token', input)).rejects.toThrow();
  expect(controller.writeln).not.toHaveBeenCalled();
});
test.each(['stale', 'probe', 'laser', 'workflow', 'queue', 'alarm'])('rejects %s controller before jogging', async condition => {
  const { service, controller, report, home } = setup();
  await home(); controller.writeln.mockClear();
  if (condition === 'stale') {
 controller.status.statusAgeMs = 2000;
}
  if (condition === 'probe') {
 report.pinState = 'P';
}
  if (condition === 'laser') {
 controller.status.controller.settings.settings.$32 = '1';
}
  if (condition === 'workflow') {
 controller.status.workflow.state = 'running';
}
  if (condition === 'queue') {
 controller.status.feeder.queue = 1;
}
  if (condition === 'alarm') {
 controller.runner.emit('alarm'); report.activeState = 'Alarm';
}
  await expect(service.act('token', { action: 'jog', axis: 'X', distance: -1, feed: 100 })).rejects.toThrow();
  expect(controller.writeln).not.toHaveBeenCalled();
});

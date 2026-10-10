/* eslint-env jest */
import { controlState } from '../../app/containers/Shapeoko/control-state';

const machine = () => ({ ready: true, port: '/dev/test-only', controller: { type: 'Grbl', state: { status: { activeState: 'Idle' } }, settings: { settings: { $32: '0' } } }, workflow: { state: 'idle' } });
test('manual control requires fresh telemetry and an authorized available machine', () => {
  expect(controlState(machine(), true, true)).toMatchObject({ idle: true, mill: true, laser: false });
  expect(controlState(machine(), false, true).idle).toBe(false);
  expect(controlState(machine(), true, false).idle).toBe(false);
  expect(controlState(undefined, true, true).idle).toBe(false);
  expect(controlState({ ...machine(), ready: false }, true, true).idle).toBe(false);
});
test.each(['Run', 'Hold', 'Alarm', 'Home', undefined])('manual actions blocked in %s', activeState => {
  const value = machine(); value.controller.state.status.activeState = activeState;
  expect(controlState(value, true, true).idle).toBe(false);
});
test.each(['running', 'paused', undefined])('manual actions blocked for workflow %s', state => {
  const value = machine(); value.workflow.state = state;
  expect(controlState(value, true, true).idle).toBe(false);
});
test('laser and milling setup are distinguished by reported firmware mode', () => {
  const value = machine(); value.controller.settings.settings.$32 = '1';
  expect(controlState(value, true, true)).toMatchObject({ mill: false, laser: true });
  delete value.controller.settings.settings.$32;
  expect(controlState(value, true, true)).toMatchObject({ mill: false, laser: false });
});

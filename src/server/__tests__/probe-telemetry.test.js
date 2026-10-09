/* eslint-env jest */
import { probeTelemetry } from '../../app/containers/Shapeoko/probe-telemetry';

const machine = (pins, age = 0) => ({ ready: true, statusAgeMs: age, controller: { type: 'Grbl', state: { status: { pinState: pins } } } });

test('probe contact and release follow fresh pin reports', () => {
  expect(probeTelemetry(machine('P'), true).contact).toBe(true);
  expect(probeTelemetry(machine(''), true)).toMatchObject({ available: true, contact: false });
  expect(probeTelemetry(machine('XYZ'), true).contact).toBe(false);
});
test('missing, stale, disconnected and non-Grbl reports are unknown', () => {
  [undefined, null, -1, NaN, 6000].forEach(age => {
    const input = machine('');
    input.statusAgeMs = age;
    expect(probeTelemetry(input, true).available).toBe(false);
  });
  expect(probeTelemetry(machine(undefined), true).available).toBe(false);
  expect(probeTelemetry(machine('P'), false).available).toBe(false);
  expect(probeTelemetry(null, true).available).toBe(false);
  expect(probeTelemetry({ ...machine(''), ready: false }, true).available).toBe(false);
  expect(probeTelemetry({ ...machine(''), controller: { type: 'TinyG' } }, true).available).toBe(false);
});
test('serial age continues increasing between successful HTTP polls', () => {
  expect(probeTelemetry(machine('P', 4000), true, 1999).available).toBe(true);
  expect(probeTelemetry(machine('P', 4000), true, 2000).available).toBe(false);
});

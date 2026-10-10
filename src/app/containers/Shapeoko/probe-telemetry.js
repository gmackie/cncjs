import get from 'lodash/get';

// Server-measured serial age plus time since the browser received that snapshot.
// Never interpret missing/old telemetry as an inactive probe.
export const probeTelemetry = (machine, fresh, elapsed = 0) => {
  const age = get(machine, 'statusAgeMs');
  const pins = get(machine, 'controller.state.status.pinState');
  const totalAge = age + elapsed;
  const available = !!(fresh && machine && machine.ready === true &&
    get(machine, 'controller.type') === 'Grbl' &&
    typeof age === 'number' && Number.isFinite(age) && age >= 0 &&
    elapsed >= 0 && totalAge < 6000 && typeof pins === 'string');
  const contact = available && pins.includes('P');
  const label = contact ? 'Probe contact detected' : 'Probe input inactive';
  return { available, contact, age: totalAge, label: available ? label : 'Probe signal unavailable' };
};

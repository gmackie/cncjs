import get from 'lodash/get';

// HTTP polling is observational; never infer a ready state from an absent report.
export const controlState = (machine, fresh, canOperate) => {
  const active = get(machine, 'controller.state.status.activeState');
  const workflow = get(machine, 'workflow.state');
  const grbl = get(machine, 'controller.type') === 'Grbl';
  const idle = !!(
    fresh &&
    canOperate &&
    grbl &&
    machine.ready === true &&
    active === 'Idle' &&
    workflow === 'idle'
  );
  const mode = get(machine, 'controller.settings.settings.$32');
  return {
    idle,
    active,
    workflow,
    grbl,
    mill: idle && String(mode) === '0',
    laser: idle && String(mode) === '1',
  };
};

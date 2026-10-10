import get from 'lodash/get';

// Require a fresh report after every connection before enabling physical motion.
export const canRunToolMacro = (controller, hasFreshReport) => (
    hasFreshReport && controller.connected && !!controller.port && controller.type === 'Grbl' &&
    get(controller.state, 'status.activeState') === 'Idle' &&
    controller.workflow.state === 'idle' &&
    [0, '0'].includes(get(controller.settings, 'settings.$32'))
);

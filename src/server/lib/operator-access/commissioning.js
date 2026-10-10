import get from 'lodash/get';

// The commissioning surface accepts structured actions, never operator G-code.
export const createCommissioning = ({ controllers, access, now = Date.now, port = () => process.env.CNCJS_COMMISSIONING_PORT } = {}) => {
  const states = new WeakMap();
  const fail = message => {
 throw new Error(message);
};
  const stateFor = controller => {
    if (!states.has(controller)) {
      const state = { homed: false, pending: null, fault: '', candidate: null };
      states.set(controller, state);
      const invalidate = () => {
 state.homed = false; state.pending = null; state.candidate = null;
};
      controller.runner.on('startup', invalidate);
      controller.runner.on('alarm', invalidate);
      controller.runner.on('error', () => {
 invalidate(); state.fault = 'Controller rejected a setup command. Re-home before continuing.';
});
      controller.runner.on('ok', () => {
 if (state.pending) {
 state.pending.ack = true;
}
});
      controller.runner.on('status', report => {
        const pending = state.pending;
        if (!pending) {
 return;
}
        if (report.activeState === 'Home') {
 pending.sawHome = true;
}
        if (pending.ack && report.activeState === 'Idle') {
          const arrived = !pending.target || ['x', 'y', 'z'].every(axis => Math.abs(Number(get(report, ['mpos', axis])) - pending.target[axis]) < 0.03);
          if (arrived && (pending.action !== 'home' || pending.sawHome)) {
            if (pending.action === 'home') {
 state.homed = true;
}
            state.pending = null;
          }
        }
      });
    }
    return states.get(controller);
  };
  const current = () => {
    const all = Object.values(controllers());
    const controller = all.find(item => item.options.port === port());
    if (all.length !== 1 || !controller || controller.type !== 'Grbl' || !controller.isOpen()) {
      fail('Connect only the configured Shapeoko Grbl controller.');
    }
    return controller;
  };
  const status = () => {
    const controller = Object.values(controllers()).find(item => item.options.port === port());
    const state = controller && states.get(controller);
    return { port: port() || '', homed: !!(state && state.homed), pending: state && state.pending && state.pending.action, fault: state && state.fault, candidate: state && state.candidate };
  };
  return {
    status,
    async open(token, requestedPort, options) {
      await access.requireCommissioning(token);
      if (!port() || requestedPort !== port() || options.controllerType !== 'Grbl' || options.baudrate !== 115200 || options.ready !== true) {
        fail('Confirm readiness and connect the configured Shapeoko at 115200 baud.');
      }
      const all = Object.values(controllers());
      if (all.some(item => item.options.port !== port() || item.type !== 'Grbl')) {
 fail('Disconnect other controllers first.');
}
      access.record('commissioning_action', { action: 'connect' });
    },
    async act(token, input) {
      await access.requireCommissioning(token);
      const controller = current();
      const state = stateFor(controller);
      const action = input && input.action;
      if (action === 'cancel') {
        access.record('commissioning_action', { action });
        controller.write('\x85');
        // Retain lock until a fresh idle report, without requiring the original endpoint.
        if (state.pending && state.pending.action === 'jog') {
 state.pending.target = null;
}
        return status();
      }
      const snapshot = controller.status;
      const report = get(snapshot, 'controller.state.status', {});
      if (!snapshot.ready || snapshot.statusAgeMs === null || !Number.isFinite(snapshot.statusAgeMs) || snapshot.statusAgeMs > 1500 || get(snapshot, 'workflow.state') !== 'idle') {
 fail('Wait for a fresh idle controller report.');
}
      if (state.pending) {
 fail('Wait for the current setup move to finish.');
}
      if (get(snapshot, 'feeder.queue', 0) || get(snapshot, 'sender.total', 0)) {
 fail('Unload queued work before commissioning.');
}
      if (!['Idle', 'Alarm'].includes(report.activeState) || (report.activeState === 'Alarm' && action !== 'home')) {
 fail('Home the machine before jogging.');
}
      if (Number(report.spindle) !== 0 || String(get(snapshot, 'controller.settings.settings.$32')) !== '0') {
 fail('Commissioning requires milling mode and zero reported spindle output.');
}
      if ((report.pinState || '').includes('P') || (report.pinState || '').includes('D')) {
 fail('Clear the probe and door inputs before moving.');
}
      if (action === 'home') {
        if (input.ready !== true) {
 fail('Confirm homing clearance first.');
}
        access.record('commissioning_action', { action });
        state.homed = false; state.candidate = null; state.fault = '';
        state.pending = { action, ack: false, sawHome: false };
        controller.writeln('$H');
      } else if (action === 'jog' || action === 'capture') {
        if (!state.homed || report.activeState !== 'Idle' || report.pinState) {
 fail('Home first and clear all limit inputs.');
}
        if (String(get(snapshot, 'controller.settings.settings.$13')) !== '0') {
 fail('Position reports must use millimeters.');
}
        const position = ['x', 'y', 'z'].reduce((result, axis) => ({ ...result, [axis]: Number(get(report, ['mpos', axis])) }), {});
        if (!Object.values(position).every(Number.isFinite)) {
 fail('Machine coordinates are unavailable.');
}
        if (action === 'capture') {
          access.record('commissioning_position', { action: 'bitsetter_candidate', position });
          state.candidate = { position, at: new Date(now()).toISOString(), verified: false };
        } else {
          const { axis, distance, feed } = input;
          if (!['X', 'Y', 'Z'].includes(axis) || ![0.1, 1, 10].includes(Math.abs(distance)) || ![100, 300, 600].includes(feed) || (axis === 'Z' && (Math.abs(distance) > 1 || feed > 100))) {
 fail('Use a permitted single-axis step and feed. Z is limited to 1 mm at 100 mm/min.');
}
          const target = { ...position, [axis.toLowerCase()]: position[axis.toLowerCase()] + distance };
          if (target[axis.toLowerCase()] > -1) {
 fail('Move would approach the home switch too closely.');
}
          access.record('commissioning_action', { action, axis, distance, feed });
          state.pending = { action, ack: false, target };
          controller.writeln(`$J=G91 G21 ${axis}${distance} F${feed}`);
        }
      } else {
 fail('Unsupported commissioning action.');
}
      return status();
    },
  };
};

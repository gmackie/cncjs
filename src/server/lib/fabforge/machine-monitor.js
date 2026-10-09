import crypto from 'crypto';
import store from '../../store';
import access from '../operator-access/service';
import { configuration, request, segment } from './client';

// Observes existing controllers only. Never opens serial ports or sends commands.
export const createMachineMonitor = ({
  controllers = () => Object.values(store.get('controllers', {})),
  operator = () => access.monitoring(),
  remote = request,
  config = configuration,
  now = Date.now,
  enabled = () => process.env.CNCJS_MACHINE_MONITOR === '1',
} = {}) => {
  const observations = new WeakMap();
  let loadedJob = null;
  let pending = false;
  let lastSuccess = null;
  let error = '';
  const snapshot = () => {
    const connected = controllers().filter(c => c.type === 'Grbl' && c.isOpen());
    const controller = connected.length === 1 ? connected[0] : null;
    if (controller && !observations.has(controller)) {
      const observation = { at: null };
      observations.set(controller, observation);
      controller.runner.on('status', () => {
 observation.at = now();
});
    }
    const state = controller && controller.sender.state;
    const lease = operator();
    const release = lease.release;
    const hash = state && state.gcode ? crypto.createHash('sha256').update(state.gcode).digest('hex') : null;
    if (release && hash === release.sha256) {
      loadedJob = { ...release };
    } else if (!hash || !loadedJob || loadedJob.sha256 !== hash) {
      loadedJob = null;
    }
    const observed = controller && observations.get(controller).at;
    const fresh = observed !== null && observed !== false && controller && now() - observed < 10000;
    return {
      observedAt: new Date(now()).toISOString(),
      controller: {
        connected: !!controller,
        ambiguous: connected.length > 1,
        telemetryFresh: !!fresh,
        state: fresh ? String(controller.runner.state.status.activeState || 'Unknown').slice(0, 40) : 'Unknown',
        workflow: controller ? controller.workflow.state : 'unknown',
        totalLines: state ? state.total : 0,
        acknowledgedLines: state ? state.received : 0,
      },
      operatorId: lease.operatorId,
      releasedJob: release,
      loadedJob,
    };
  };
  return {
    snapshot,
    status: () => ({ enabled: enabled(), lastSuccess, error }),
    async sync() {
      if (!enabled() || pending) {
 return;
}
      pending = true;
      try {
        if (!config().resourceId) {
 throw new Error('Configure the FabForge machine resource.');
}
        await remote(`resources/${segment(config().resourceId)}/monitor`, { method: 'POST', body: snapshot() });
        lastSuccess = new Date(now()).toISOString();
        error = '';
      } catch (err) {
        error = err.message;
      } finally {
        pending = false;
      }
    },
  };
};
export default createMachineMonitor();

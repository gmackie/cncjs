import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import get from 'lodash/get';
import { operatorAccess } from 'app/api';
import controller from 'app/lib/controller';
import styles from './index.styl';

export default class CommissioningControls extends PureComponent {
  static propTypes = { machine: PropTypes.object, fresh: PropTypes.bool, access: PropTypes.object };
  state = { setup: {}, access: {}, ready: false, step: 1, feed: 100, busy: false, error: '', confirmHome: false };
  componentDidMount() {
 this.poll();
}
  componentWillUnmount() {
 this.unmounted = true; clearTimeout(this.timer);
}
  poll = async () => {
    try {
      const [setup, access] = await Promise.all([operatorAccess('GET', '/commissioning'), operatorAccess()]);
      if (!this.unmounted) {
 this.setState({ setup, access });
}
    } catch (err) {
      if (!this.unmounted) {
 this.setState({ access: {}, error: err.message });
}
    }
    if (!this.unmounted) {
 this.timer = setTimeout(this.poll, 1000);
}
  };
  perform = async action => {
    if (this.inFlight) {
 return;
}
    this.inFlight = true;
    this.setState({ busy: true, error: '' });
    try {
 await action();
} catch (err) {
 if (!this.unmounted) {
 this.setState({ error: err.message });
}
} finally {
 this.inFlight = false; if (!this.unmounted) {
 this.setState({ busy: false });
}
}
  };
  act = body => this.perform(async () => {
    const setup = await operatorAccess('POST', '/commissioning/action', body);
    if (!this.unmounted) {
 this.setState({ setup, confirmHome: false });
}
  });
  connect = () => this.perform(() => new Promise((resolve, reject) => {
    if (!controller.connected) {
 reject(new Error('Waiting for the kiosk connection.')); return;
}
    const timer = setTimeout(() => reject(new Error('Connection timed out. Check machine status before retrying.')), 10000);
    controller.openPort(this.state.setup.port, { controllerType: 'Grbl', baudrate: 115200, commissioning: true, ready: this.state.ready }, err => {
      clearTimeout(timer);
      if (err) {
 reject(new Error(err.message || 'Connection failed.'));
} else {
 resolve();
}
    });
  }));
  render() {
    const { machine, fresh } = this.props;
    const { setup, access, busy, ready, step, feed, error, confirmHome } = this.state;
    const active = access.authorized && access.commissioningUntil > Date.now();
    const connected = machine && machine.ready;
    const report = get(machine, 'controller.state.status', {});
    const recent = fresh && Number.isFinite(machine && machine.statusAgeMs) && machine.statusAgeMs <= 1500;
    const idle = active && recent && connected && report.activeState === 'Idle' && !setup.pending && !busy;
    const jog = idle && setup.homed;
    return (
      <section className={styles.panel} aria-label="Supervised commissioning controls">
        <span className={styles.eyebrow}>AT THE MACHINE · SETUP ONLY</span>
        <h2>Position over BitSetter</h2>
        <p>BitSetter is at the front-left. Jog one axis at a time, align the cutter over the button, then capture its position. Capturing records a candidate only; it does not probe, set zero, or enable an automatic routine.</p>
        {!access.authorized && <p>Use <strong>Badge in</strong> above and type your enrolled temporary code. The RFID reader is not required.</p>}
        {access.authorized && !access.commissioningAllowed && <p>This badge does not have commissioning permission for this machine.</p>}
        <label><input type="checkbox" checked={ready} onChange={event => this.setState({ ready: event.target.checked })} /> I am at the machine, DWP611 unplugged, laser power off, BitZero and lead parked clear, travel clear, and stop within reach.</label>
        <div className={styles.actions}>
          {!active ? (
            <button
              type="button" disabled={!access.commissioningAllowed || !ready || busy} onClick={() => this.perform(async () => {
            const result = await operatorAccess('POST', '/commissioning/session', { ready });
            if (!this.unmounted) {
 this.setState({ access: result });
}
          })}
            >Begin 30-minute setup session
            </button>
) : (
  <button
    type="button" disabled={busy} onClick={() => this.perform(async () => {
            const result = await operatorAccess('DELETE', '/commissioning/session');
            if (!this.unmounted) {
 this.setState({ access: result });
}
          })}
  >End setup · lock controls
  </button>
)}
          <button type="button" disabled={!active || !ready || !!machine || busy || !setup.port} onClick={this.connect}>Connect Shapeoko</button>
          <button type="button" disabled={!active || !ready || !recent || !connected || !!setup.pending || busy || !['Idle', 'Alarm'].includes(report.activeState)} onClick={() => this.setState({ confirmHome: true })}>Home…</button>
          <button type="button" disabled={!active || !connected} onClick={() => this.act({ action: 'cancel' })}>Cancel jog</button>
          <button type="button" onClick={() => operatorAccess('POST', '/hold').catch(err => this.setState({ error: err.message }))}>Feed hold</button>
        </div>
        {active && <p>Setup ends {new Date(access.commissioningUntil).toLocaleTimeString()}. Job Start, raw commands, macros, zero-setting and laser output remain locked.</p>}
        <p>Connection can reset Grbl. Home after connecting. Cancel jog does not stop homing; use the physical stop if needed. Camera and feed hold are not emergency stops.</p>
        {confirmHome && <div role="alert"><p>Home moves Z, then X/Y to their switches. Confirm the entire homing path is clear.</p><button type="button" disabled={busy || !active || !ready} onClick={() => this.act({ action: 'home', ready: true })}>Confirm · home machine</button><button type="button" onClick={() => this.setState({ confirmHome: false })}>Back</button></div>}
        <div className={styles.actions}>
          <label>XY step <select value={step} onChange={e => this.setState({ step: Number(e.target.value) })}>{[0.1, 1, 10].map(n => <option key={n} value={n}>{n} mm</option>)}</select></label>
          <label>XY feed <select value={feed} onChange={e => this.setState({ feed: Number(e.target.value) })}>{[100, 300, 600].map(n => <option key={n} value={n}>{n} mm/min</option>)}</select></label>
        </div>
        <div className={styles.actions}>
          {[['X', -1, '← Left'], ['X', 1, 'Right →'], ['Y', -1, 'Front ↓'], ['Y', 1, 'Rear ↑'], ['Z', 1, 'Z up'], ['Z', -1, 'Z down']].map(([axis, sign, label]) => (
            <button
              type="button" key={axis + sign} disabled={!jog || !ready}
              onClick={() => this.act({ action: 'jog', axis, distance: sign * (axis === 'Z' ? Math.min(step, 1) : step), feed: axis === 'Z' ? 100 : feed })}
            >{label} · {axis === 'Z' ? Math.min(step, 1) : step} mm
            </button>
))}
        </div>
        <p>{setup.pending && `Waiting for ${setup.pending} completion…`}{!setup.pending && (setup.homed ? 'Homing reference established for this connection.' : 'Home through these controls before jogging.')} Travel is not yet calibrated; stop short of physical limits.</p>
        <button type="button" disabled={!jog || !ready} onClick={() => this.act({ action: 'capture' })}>Capture BitSetter candidate position</button>
        {setup.candidate && <p role="status">Candidate: {['x', 'y', 'z'].map(axis => `${axis.toUpperCase()} ${setup.candidate.position[axis].toFixed(3)} mm`).join(' · ')}. Saved in the commissioning journal; not a calibrated probe location.</p>}
        {(error || setup.fault) && <p role="alert">{error || setup.fault}</p>}
      </section>
    );
  }
}

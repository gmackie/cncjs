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
    let probeLabel = 'Unknown';
    if (recent && typeof report.pinState === 'string') {
 probeLabel = report.pinState.includes('P') ? 'Contact' : 'Clear';
}
    const nextStep = [
      [!access.authorized, 'Badge in to begin supervised setup.'],
      [!access.commissioningAllowed, 'This badge needs commissioning permission.'],
      [!ready, 'Confirm physical readiness below.'],
      [!active, 'Begin a setup session to unlock connection.'],
      [!connected, 'Connect Shapeoko, then home the machine.'],
      [!recent, 'Waiting for a fresh controller report.'],
      [!!setup.pending, `Waiting for ${setup.pending} to finish.`],
      [!setup.homed, 'Home the machine to establish its position.'],
      [report.activeState !== 'Idle', 'Wait for the machine to return to Idle.'],
    ].find(([blocked]) => blocked);
    const directionButton = (axis, sign, label) => (
      <button
        type="button" className={styles[`jog${axis}${sign > 0 ? 'Plus' : 'Minus'}`]}
        disabled={!jog || !ready} aria-label={`${label}, ${axis === 'Z' ? Math.min(step, 1) : step} millimeters`}
        onClick={() => this.act({ action: 'jog', axis, distance: sign * (axis === 'Z' ? Math.min(step, 1) : step), feed: axis === 'Z' ? 100 : feed })}
      >{label}<small>{axis === 'Z' ? Math.min(step, 1) : step} mm</small>
      </button>
    );
    return (
      <section className={styles.panel} aria-label="Supervised commissioning controls">
        <span className={styles.eyebrow}>AT THE MACHINE · SETUP ONLY</span>
        <h2>Position over BitSetter</h2>
        <div className={styles.commissionStatus} role="status">
          <strong>{nextStep ? nextStep[1] : 'Ready to jog · one click, one move'}</strong>
          <span>{connected ? report.activeState : 'Disconnected'} · {active ? 'Setup session active' : 'Controls locked'}</span>
        </div>
        <div className={styles.jogReadout} aria-label="Machine position and probe">
          {['x', 'y', 'z'].map(axis => {
            const value = get(report, ['mpos', axis]);
            const valid = recent && value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value));
            return <div key={axis}><span>Machine {axis.toUpperCase()}</span><strong>{valid ? Number(value).toFixed(3) : '—'}</strong><small>mm</small></div>;
          })}
          <div><span>Probe input</span><strong>{probeLabel}</strong><small>BitZero / BitSetter</small></div>
        </div>
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
        <div className={styles.jogLayout}>
          <div>
            <fieldset className={styles.stepChoices}>
              <legend>XY step · millimeters</legend>
              {[0.1, 1, 10, 25, 50, 100].map(n => (
                <button
                  type="button" key={n} aria-pressed={step === n}
                  onClick={() => this.setState({ step: n })}
                >{n}
                </button>
              ))}
            </fieldset>
            <label>XY speed
              <select value={feed} onChange={e => this.setState({ feed: Number(e.target.value) })}>
                {[100, 300, 600].map(n => <option key={n} value={n}>{n} mm/min</option>)}
              </select>
            </label>
            <p className={styles.subtle}>Each XY click moves {step} mm · about {Math.max(1, Math.round(step / feed * 60))} seconds. Use smaller steps near the button.</p>
            <div className={styles.jogPad} aria-label="XY direction pad">
              {directionButton('Y', 1, '↑ Rear')}
              {directionButton('X', -1, '← Left')}
              <span className={styles.jogCenter}>XY<small>Viewed from front</small></span>
              {directionButton('X', 1, 'Right →')}
              {directionButton('Y', -1, '↓ Front')}
            </div>
          </div>
          <div className={styles.zJog} aria-label="Z height controls">
            <span className={styles.eyebrow}>TOOL HEIGHT</span>
            <h3>Z axis</h3>
            {directionButton('Z', 1, '↑ Raise')}
            {directionButton('Z', -1, '↓ Lower')}
            <p>{Math.min(step, 1)} mm per click<br />100 mm/min</p>
            <p className={styles.subtle}>Keep the cutter above the button. Position capture requires no contact.</p>
          </div>
        </div>
        <p>{setup.pending && `Waiting for ${setup.pending} completion…`}{!setup.pending && (setup.homed ? 'Homing reference established for this connection.' : 'Home through these controls before jogging.')} Travel is not yet calibrated; stop short of physical limits.</p>
        <button type="button" disabled={!jog || !ready} onClick={() => this.act({ action: 'capture' })}>Capture BitSetter candidate position</button>
        {setup.candidate && <p role="status">Candidate: {['x', 'y', 'z'].map(axis => `${axis.toUpperCase()} ${setup.candidate.position[axis].toFixed(3)} mm`).join(' · ')}. Saved in the commissioning journal; not a calibrated probe location.</p>}
        {(error || setup.fault) && <p role="alert">{error || setup.fault}</p>}
      </section>
    );
  }
}

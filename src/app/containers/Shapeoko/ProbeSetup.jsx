import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import get from 'lodash/get';
import CameraMonitor from './CameraMonitor';
import MachineControls from './MachineControls';
import { probeTelemetry } from './probe-telemetry';
import styles from './index.styl';

const steps = [
  ['Prepare the tool', 'Unplug the DWP611 and disable laser power. Fit your intact, conductive flat-end cutter in a DWP611-compatible ⅛″ precision collet. Never use the stock ¼″ collet for a ⅛″ shank. BitSetter measures the cutter directly; a smooth pin is preferred for BitZero X/Y because flutes can reduce repeatability.'],
  ['Check both probe inputs', 'Connect only when you are at the machine and ready for a possible controller reset. With axes stationary, attach the BitZero magnet to the collet nut. Carefully touch its body to the conductive cutter, keeping fingers clear of sharp edges. Check inactive → contact → inactive below. Park BitZero clear, then depress and release BitSetter independently. Both share one input; the UI cannot identify which accessory triggered it.'],
  ['Commission homing & clearance', 'Supervised homing and measured travel come before automatic probing. The saved Y travel of 850 mm is unverified for this XL. Measure the BitSetter button center, approach height, safe route and bounded search distance. Do not treat historical coordinates as calibrated positions.'],
  ['Locate the stock with BitZero V2', 'Secure stock and match the CAM origin. For lower-left XYZ, seat the locating edges over the stock corner and begin just inside the circular bore. For Z-only, rest the probe on the stock surface and start above its top. These use different offsets. A reviewed V2-specific routine is still required; the buttons below do not run one.'],
  ['Preserve the tool reference', 'Measure the first tool with a commissioned BitSetter routine, then establish stock zero using that same tool. After a tool change, measure the new cutter and apply its length difference once using a validated offset convention. Reset, lost homing, a moved router or missed steps invalidates the reference.'],
  ['Verify before cutting', 'Check the resulting stock datum independently with router power off. Test repeatability with the same tool and after a tool change. Remove BitZero and its grounding lead from the work envelope. Set router speed and power manually when ready; release the reviewed job in the queue, then Start separately.'],
];
const guides = [
  ['bitzero-bitsetter', 'BitZero V2 & BitSetter'],
  ['dwp611', 'DWP611 installation & use'],
  ['jtech-7w', 'J Tech 7 W installation & use'],
];

export default class ProbeSetup extends PureComponent {
  static propTypes = {
    machine: PropTypes.object,
    fresh: PropTypes.bool,
    canOperate: PropTypes.bool,
    access: PropTypes.object,
  };
  state = { step: 0, guide: 'bitzero-bitsetter', tick: Date.now() };
  componentDidMount() {
    this.receivedAt = Date.now();
    this.timer = setInterval(() => this.setState({ tick: Date.now() }), 500);
  }
  componentWillReceiveProps(next) {
    if (next.machine !== this.props.machine) {
      this.receivedAt = Date.now();
    }
  }
  componentWillUnmount() {
    clearInterval(this.timer);
  }
  render() {
    const { machine, fresh, canOperate, access } = this.props;
    const { step, guide, tick } = this.state;
    const telemetry = probeTelemetry(machine, fresh, Math.max(0, tick - (this.receivedAt || tick)));
    const probeLabel = telemetry.contact ? 'P · contact detected' : 'No P · inactive';
    const status = get(machine, 'controller.state.status', {});
    const units = Number(get(machine, 'controller.settings.settings.$13')) === 1 ? 'in' : 'mm';
    return (
      <div>
        <div className={styles.workflowNote}>
          <strong>Physical commissioning pending</strong>
          <span>Read the instructions and inspect the signals here. Automatic V2 probing and tool compensation are unavailable until their routines and geometry are validated. Reading a step does not certify setup.</span>
        </div>
        <div className={styles.setupGrid}>
          <section className={styles.panel} aria-label="Guided probe setup">
            <span className={styles.eyebrow}>BITZERO V2 + BITSETTER / ⅛″ CUTTER</span>
            <h2>Set up, check, then measure</h2>
            <nav className={styles.setupSteps} aria-label="Setup instructions">
              {steps.map(([title], index) => (
                <button
                  type="button" key={title} aria-current={step === index ? 'step' : undefined}
                  onClick={() => this.setState({ step: index })}
                >
                  <span>{index + 1}</span>{title}
                </button>
              ))}
            </nav>
            <article className={styles.setupInstruction} aria-live="polite">
              <span className={styles.tiny}>STEP {step + 1} OF {steps.length}</span>
              <h3>{steps[step][0]}</h3>
              <p>{steps[step][1]}</p>
            </article>
            <div className={styles.actions}>
              <button type="button" disabled={step === 0} onClick={() => this.setState({ step: step - 1 })}>Previous instruction</button>
              <button type="button" disabled={step === steps.length - 1} onClick={() => this.setState({ step: step + 1 })}>Next instruction</button>
            </div>
          </section>
          <div className={styles.setupMonitor}>
            <CameraMonitor />
            <section className={styles.panel} aria-label="Probe and position monitor">
              <span className={styles.eyebrow}>CONTROLLER OBSERVATION</span>
              <h2>{telemetry.label}</h2>
              <p>{telemetry.available ? `Grbl report age: ${(telemetry.age / 1000).toFixed(1)} s · ${status.activeState}` : 'A fresh report from one ready Grbl controller is required.'}</p>
              <p>Shared probe input: <strong>{telemetry.available ? probeLabel : 'Unknown'}</strong></p>
              <p className={styles.subtle}>Watch for inactive → contact → inactive for each accessory. A stationary test does not run a probe cycle or validate tool offsets.</p>
              <table className={styles.setupCoordinates}>
                <caption>Reported position ({units})</caption>
                <thead><tr><th scope="col">Axis</th><th scope="col">Machine</th><th scope="col">Work</th></tr></thead>
                <tbody>{['x', 'y', 'z'].map(axis => (
                  <tr key={axis}><th scope="row">{axis.toUpperCase()}</th>{['mpos', 'wpos'].map(frame => {
                  const value = get(status, [frame, axis]);
                  return <td key={frame}>{telemetry.available && value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value).toFixed(3) : '—'}</td>;
                })}
                  </tr>
))}
                </tbody>
              </table>
              <p className={styles.subtle}>Coordinates do not prove homing. M5 does not unplug the DWP611. Camera images do not establish clearance.</p>
            </section>
          </div>
        </div>
        <section className={styles.setupControls} aria-label="Setup machine controls">
          <h2>Connection & positioning</h2>
          <p>Badge authorization and machine availability are required. Connect and Home ask for confirmation; jog buttons move immediately. Zero buttons set the current position as G54 zero—they do not probe the stock.</p>
          <MachineControls
            key={canOperate ? 'operator' : 'viewer'} machine={machine} fresh={fresh && telemetry.available}
            canOperate={canOperate} access={access} setupOnly
          />
        </section>
        <section className={styles.panel} aria-label="Detailed operator handbook">
          <span className={styles.eyebrow}>INSTALLATION / SETUP / DAILY USE</span>
          <h2>Operator handbook</h2>
          <label>Choose a guide
            <select value={guide} onChange={event => this.setState({ guide: event.target.value })}>
              {guides.map(([id, title]) => <option key={id} value={id}>{title}</option>)}
            </select>
          </label>
          <p><a href={`/assets/guides/${guide}.html`} target="_blank" rel="noopener noreferrer">Open full guide / print ↗</a></p>
          <iframe
            sandbox="allow-scripts allow-same-origin allow-popups allow-modals"
            className={styles.setupHandbook} key={guide} title={guides.find(([id]) => id === guide)[1]}
            src={`/assets/guides/${guide}.html`}
          />
        </section>
      </div>
    );
  }
}

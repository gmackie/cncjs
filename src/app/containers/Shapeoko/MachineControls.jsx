import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import get from 'lodash/get';
import api from 'app/api';
import controller from 'app/lib/controller';
import { controlState } from './control-state';
import styles from './index.styl';
import Dialog from './Dialog';

export default class MachineControls extends PureComponent {
  static propTypes = {
    machine: PropTypes.object,
    fresh: PropTypes.bool,
    canOperate: PropTypes.bool,
    access: PropTypes.object,
    setupOnly: PropTypes.bool,
  };
  state = {
    ports: [],
    port: '',
    step: '1',
    feed: '300',
    error: '',
    notice: '',
    confirm: null,
    macros: [],
    selected: null,
    acknowledged: false,
    busy: false,
    loadedHash: '',
  };
  componentDidMount() {
    controller.addListener('serialport:list', this.ports);
    controller.addListener('operator:denied', this.denied);
    this.refreshPorts();
    if (this.props.canOperate) {
      this.fetchMacros();
    }
  }
  componentWillUnmount() {
    this.unmounted = true;
    clearTimeout(this.timer);
    controller.removeListener('serialport:list', this.ports);
    controller.removeListener('operator:denied', this.denied);
  }
  ports = (ports) => this.setState({ ports });
  denied = (result) => this.setState({ error: result.msg, notice: '', busy: false });
  refreshPorts = () => {
    if (controller.socket) {
      controller.socket.emit('list');
    }
  };
  fetchMacros = async () => {
    try {
      const res = await api.macros.fetch();
      if (!this.unmounted) {
        this.setState({ macros: res.body.records || [] });
      }
    } catch (err) {
      if (!this.unmounted) {
        this.setState({ error: 'Could not read BitSetter macros.' });
      }
    }
  };
  emit = (command, ...args) => {
    if (
      !this.props.canOperate ||
      !this.props.fresh ||
      !this.props.machine ||
      !controller.connected
    ) {
      return;
    }
    controller.socket.emit(
      'command',
      this.props.machine.port,
      command,
      ...args
    );
    this.setState({
      confirm: null,
      error: '',
      notice: 'Command submitted. Verify the machine response.',
    });
  };
  jog = (axis, direction) => {
    if (
      !controlState(this.props.machine, this.props.fresh, this.props.canOperate)
        .idle
    ) {
      return;
    }
    const step = Number(this.state.step);
    const feed = Number(this.state.feed);
    if (![0.1, 1, 10].includes(step) || ![100, 300, 600].includes(feed)) {
      return;
    }
    this.emit('gcode', `$J=G91 G21 ${axis}${step * direction} F${feed}`);
  };
  connect = () => {
    if (!this.props.canOperate || !this.state.port || !controller.connected) {
      return;
    }
    this.setState({ busy: true, confirm: null, error: '' });
    this.timer = setTimeout(() => {
      if (!this.unmounted) {
        this.setState({
          busy: false,
          error:
            'Connection acknowledgement timed out. Check the controller before retrying.',
        });
      }
    }, 10000);
    controller.openPort(
      this.state.port,
      { controllerType: 'Grbl', baudrate: 115200 },
      (err) => {
        clearTimeout(this.timer);
        if (!this.unmounted) {
          this.setState({
            busy: false,
            error: err ? err.message || 'Connection failed.' : '',
            notice: err
              ? ''
              : 'Connection requested. Waiting for the machine status.',
          });
        }
      }
    );
  };
  loadReleased = async () => {
    const { access, machine, fresh, canOperate } = this.props;
    if (
      !access ||
      !access.release ||
      !controlState(machine, fresh, canOperate).idle
    ) {
      return;
    }
    this.setState({ busy: true, error: '', notice: '', loadedHash: '' });
    try {
      const release = access.release;
      const reviewed = await api.fabforge(
        `work-orders/${encodeURIComponent(
          release.workOrderId
        )}/jobs/${encodeURIComponent(release.jobId)}/review`,
        { source: release.source }
      );
      if (reviewed.hash !== release.sha256 || !reviewed.analysis.complete) {
        throw new Error(
          'The released file changed or cannot be simulated. Review it again.'
        );
      }
      const current = controlState(
        this.props.machine,
        this.props.fresh,
        this.props.canOperate
      );
      if (
        !(reviewed.job.processType === 'laser_cut'
          ? current.laser
          : current.mill)
      ) {
        throw new Error(
          'Reported controller mode does not match this job. Verify the machine setup.'
        );
      }
      await api.loadGCode({
        port: machine.port,
        name: `FabForge-${release.jobId}.nc`,
        gcode: reviewed.gcode,
      });
      if (!this.unmounted) {
        this.setState({
          loadedHash: reviewed.hash,
          notice:
            'Reviewed file loaded. Verify physical setup and router/laser readiness before starting.',
        });
      }
    } catch (err) {
      if (!this.unmounted) {
        this.setState({
          error:
            err.message || get(err, 'body.msg', 'File could not be loaded.'),
        });
      }
    } finally {
      if (!this.unmounted) {
        this.setState({ busy: false });
      }
    }
  };
  reviewMacro = async (id) => {
    try {
      const res = await api.macros.read(id);
      if (!this.unmounted) {
        this.setState({ selected: res.body, acknowledged: false, error: '' });
      }
    } catch (err) {
      if (!this.unmounted) {
        this.setState({ error: 'Could not read this macro.' });
      }
    }
  };
  runMacro = () => {
    if (
      !controlState(this.props.machine, this.props.fresh, this.props.canOperate)
        .mill ||
      this.props.setupOnly ||
      /^(Initial|New) Tool Set$/i.test(get(this.state.selected, 'name', '')) ||
      !this.state.acknowledged ||
      this.state.busy
    ) {
      return;
    }
    const { selected } = this.state;
    this.setState({ busy: true, error: '', notice: '' });
    this.timer = setTimeout(() => {
      if (!this.unmounted) {
        this.setState({
          busy: false,
          selected: null,
          error: 'No macro acknowledgement. Check the machine before retrying.',
        });
      }
    }, 10000);
    this.emit(
      'macro:run-reviewed',
      selected.id,
      selected.content,
      controller.context,
      (err) => {
        clearTimeout(this.timer);
        if (!this.unmounted) {
          this.setState({
            busy: false,
            selected: null,
            acknowledged: false,
            error: err ? err.message : '',
            notice: err
              ? ''
              : 'Macro submitted. Watch the machine; submission does not confirm probing completed.',
          });
        }
      }
    );
  };
  render() {
    const { machine, fresh, canOperate, access, setupOnly } = this.props;
    const { busy, confirm, selected } = this.state;
    const state = controlState(machine, fresh, canOperate);
    const release = access && access.release;
    const loaded = release && this.state.loadedHash === release.sha256;
    return (
      <div>
        {!canOperate && (
          <div className={styles.lockNotice}>
            <strong>Controls are locked.</strong>
            <span>
              Badge in with machine authorization. FabForge must also mark this
              machine available after commissioning.
            </span>
          </div>
        )}
        {this.state.error && (
          <p className={styles.alert} role="alert">
            {this.state.error}
          </p>
        )}
        {this.state.notice && (
          <p className={styles.notice} role="status">
            {this.state.notice}
          </p>
        )}
        <div className={styles.controlsGrid}>
          <section className={styles.panel}>
            <span className={styles.eyebrow}>CONNECTION</span>
            <h2>Machine link</h2>
            <p>{machine ? machine.port : 'No controller connected'}</p>
            <label>
              Serial port
              <select
                value={this.state.port}
                onChange={(e) => this.setState({ port: e.target.value })}
              >
                <option value="">Choose a port</option>
                {this.state.ports.map((port) => (
                  <option key={port.port} value={port.port}>
                    {port.port}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.actions}>
              <button type="button" onClick={this.refreshPorts}>
                Refresh ports
              </button>
              <button
                type="button"
                disabled={!canOperate || busy || !!machine || !this.state.port}
                onClick={() => this.setState({ confirm: 'connect' })}
              >
                Connect Grbl
              </button>
            </div>
            <p className={styles.subtle}>
              115200 baud. Opening the serial connection may reset the
              controller.
            </p>
          </section>
          <section className={styles.panel}>
            <span className={styles.eyebrow}>MANUAL POSITIONING</span>
            <h2>Jog & work origin</h2>
            <div className={styles.jogGrid}>
              {[
                ['Y+', 'Y', 1],
                ['Z+', 'Z', 1],
                ['X−', 'X', -1],
                ['X+', 'X', 1],
                ['Y−', 'Y', -1],
                ['Z−', 'Z', -1],
              ].map(([label, axis, direction]) => (
                <button
                  type="button"
                  disabled={!state.idle || busy}
                  key={label}
                  onClick={() => this.jog(axis, direction)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className={styles.fields}>
              <label>
                Step
                <select
                  value={this.state.step}
                  onChange={(e) => this.setState({ step: e.target.value })}
                >
                  {['0.1', '1', '10'].map((v) => (
                    <option key={v} value={v}>
                      {v} mm
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Jog feed
                <select
                  value={this.state.feed}
                  onChange={(e) => this.setState({ feed: e.target.value })}
                >
                  {['100', '300', '600'].map((v) => (
                    <option key={v} value={v}>
                      {v} mm/min
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className={styles.actions}>
              {['X', 'Y', 'Z'].map((axis) => (
                <button
                  type="button"
                  key={axis}
                  disabled={!state.idle || busy}
                  onClick={() => this.setState({ confirm: `zero-${axis}` })}
                >
                  Zero {axis}
                </button>
              ))}
              <button
                type="button"
                disabled={
                  !canOperate ||
                  !fresh ||
                  !machine ||
                  !['Idle', 'Alarm'].includes(state.active) ||
                  busy
                }
                onClick={() => this.setState({ confirm: 'home' })}
              >
                Home machine
              </button>
            </div>
          </section>
          {!setupOnly && (
          <section className={styles.panel}>
            <span className={styles.eyebrow}>RELEASED WORK</span>
            <h2>Load. Verify. Start.</h2>
            <p>
              {release
                ? `Job ${release.jobId}`
                : 'Release a reviewed job from the work queue to begin setup.'}
            </p>
            {release && <code>{release.sha256.slice(0, 20)}…</code>}
            <p className={styles.subtle}>
              {get(machine, 'sender.name', 'No loaded program')}
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                disabled={!state.idle || !release || busy}
                onClick={this.loadReleased}
              >
                Load released file
              </button>
              <button
                type="button"
                className={styles.primary}
                disabled={!state.idle || !loaded || busy}
                onClick={() => this.setState({ confirm: 'start' })}
              >
                Start job
              </button>
              <button
                type="button"
                disabled={
                  !canOperate ||
                  !fresh ||
                  !machine ||
                  state.workflow !== 'paused' ||
                  !loaded ||
                  busy
                }
                onClick={() => this.setState({ confirm: 'resume' })}
              >
                Resume
              </button>
            </div>
            <p className={styles.subtle}>
              The DWP611’s switch and speed dial are manual. A laser job
              requires its installed hardware and controller mode to be
              verified.
            </p>
          </section>
)}
          <section className={styles.panel}>
            <span className={styles.eyebrow}>CARBIDE BITSETTER</span>
            <h2>Keep the tool reference</h2>
            <p>
              The 2020 Initial Tool Set and New Tool Set macros need replacement.
              Their work-coordinate reference can become incorrect after stock zero changes.
            </p>
            <button
              type="button"
              disabled={!canOperate}
              onClick={this.fetchMacros}
            >
              Read saved macros
            </button>
            {this.state.macros.map((macro) => (
              <button
                type="button"
                className={styles.macroRow}
                key={macro.id}
                disabled={busy}
                onClick={() => this.reviewMacro(macro.id)}
              >
                {macro.name}
                <span>Review ↗</span>
              </button>
            ))}
            <p className={styles.subtle}>
              Saved location and clearance are unverified. A controller reset
              requires checking the reference again.
            </p>
          </section>
        </div>
        {confirm && (
          <Dialog label="Confirm machine action" onClose={() => this.setState({ confirm: null })}>
            <h2>
              {{ connect: 'Connect to the Shapeoko?', home: 'Home the machine?', 'zero-X': 'Set work X to zero?', 'zero-Y': 'Set work Y to zero?', 'zero-Z': 'Set work Z to zero?' }[confirm] || 'Start motion?'}
            </h2>
            <p>
              {confirm.startsWith('zero')
                ? 'This sets G54 at the current position for this axis. Confirm your CAM job uses G54.'
                : 'Be at the machine, confirm the travel area is clear and verify the installed tool and power state. You must be able to stop it immediately.'}
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                onClick={() => this.setState({ confirm: null })}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.primary}
                disabled={!canOperate || busy}
                onClick={() => {
                  if (confirm === 'connect') {
                    this.connect();
                    return;
                  }
                  const ready = controlState(
                    this.props.machine,
                    this.props.fresh,
                    this.props.canOperate
                  );
                  if (confirm.startsWith('zero') && ready.idle) {
                    this.emit('gcode', `G10 L20 P1 ${confirm.slice(-1)}0`);
                  } else if (
                    confirm === 'home' &&
                    ['Idle', 'Alarm'].includes(ready.active)
                  ) {
                    this.emit('homing');
                  } else if (confirm === 'start' && ready.idle && loaded) {
                    this.emit('gcode:start');
                  } else if (
                    confirm === 'resume' &&
                    ready.workflow === 'paused' &&
                    loaded
                  ) {
                    this.emit('gcode:resume');
                  }
                }}
              >
                Confirm{' '}
                {{ home: 'homing', connect: 'connection' }[confirm] || 'action'}
              </button>
            </div>
          </Dialog>
        )}
        {selected && (
          <Dialog label="Review BitSetter macro" onClose={() => this.setState({ selected: null })}>
            <h2>{selected.name}</h2>
            <pre>{selected.content}</pre>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={this.state.acknowledged}
                onChange={(e) => this.setState({ acknowledged: e.target.checked })}
              />
              I verified the saved probe coordinates, clearance, tool and
              machine setup.
            </label>
            <div className={styles.actions}>
              <button
                type="button"
                onClick={() => this.setState({ selected: null })}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={setupOnly || /^(Initial|New) Tool Set$/i.test(selected.name) || !state.mill || !this.state.acknowledged || busy}
                onClick={this.runMacro}
              >
                {setupOnly || /^(Initial|New) Tool Set$/i.test(selected.name) ? 'Probing unavailable · commissioning pending' : 'Run reviewed macro'}
              </button>
            </div>
          </Dialog>
        )}
      </div>
    );
  }
}

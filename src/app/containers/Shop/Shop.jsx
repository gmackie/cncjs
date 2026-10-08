import get from 'lodash/get';
import React, { PureComponent } from 'react';
import { Link } from 'react-router-dom';
import api from 'app/api';
import controller from 'app/lib/controller';
import i18n from 'app/lib/i18n';
import styles from './index.styl';
import Camera from './Camera';
import { canRunToolMacro } from './machine-state';

const events = ['connect', 'disconnect', 'serialport:open', 'serialport:close', 'controller:settings', 'workflow:state'];

class Shop extends PureComponent {
    state = {
      tab: 'overview',
      freshReport: false,
      connected: controller.connected,
      port: controller.port,
      type: controller.type,
      machine: controller.state,
      settings: controller.settings,
      workflow: controller.workflow.state,
      macros: [],
      loading: true,
      error: '',
      selected: null,
      acknowledged: false,
      pending: false,
      notice: ''
    };

    componentDidMount() {
      events.forEach(event => controller.addListener(event, this.sync));
      controller.addListener('controller:state', this.onReport);
      controller.addListener('connect', this.invalidateReport);
      controller.addListener('disconnect', this.invalidateReport);
      controller.addListener('serialport:close', this.invalidateReport);
      this.fetchMacros();
    }

    componentWillUnmount() {
      this.unmounted = true;
      clearTimeout(this.submitTimeout);
      controller.removeListener('controller:state', this.onReport);
      controller.removeListener('connect', this.invalidateReport);
      controller.removeListener('disconnect', this.invalidateReport);
      controller.removeListener('serialport:close', this.invalidateReport);
      events.forEach(event => controller.removeListener(event, this.sync));
    }

    invalidateReport = () => this.setState({ freshReport: false, acknowledged: false });

    onReport = () => {
      this.sync();
      this.setState({ freshReport: true });
    };

    sync = () => {
      this.setState({
        connected: controller.connected,
        port: controller.port,
        type: controller.type,
        machine: controller.state,
        settings: controller.settings,
        workflow: controller.workflow.state,
        acknowledged: controller.connected && controller.port ? this.state.acknowledged : false
      });
    };

    fetchMacros = async () => {
      this.setState({ loading: true, error: '' });
      try {
        const res = await api.macros.fetch();
        if (!this.unmounted) {
          this.setState({ macros: res.body.records || [], loading: false });
        }
      } catch (err) {
        if (!this.unmounted) {
          this.setState({ error: i18n._('Could not load saved macros. Try again.'), loading: false });
        }
      }
    };

    reviewMacro = async (id) => {
      this.setState({ error: '', notice: '' });
      try {
        const res = await api.macros.read(id);
        if (!this.unmounted) {
          this.setState({ selected: res.body, acknowledged: false });
        }
      } catch (err) {
        if (!this.unmounted) {
          this.setState({ error: i18n._('Could not load this macro. Try again.') });
        }
      }
    };

    canRun = () => canRunToolMacro(controller, this.state.freshReport);

    runMacro = () => {
      if (!this.canRun() || !this.state.acknowledged || this.state.pending || !this.state.selected) {
        return;
      }
      const { id } = this.state.selected;
      this.setState({ pending: true, error: '' });
      this.submitTimeout = setTimeout(() => {
        if (!this.unmounted) {
          this.setState({ selected: null, pending: false, acknowledged: false, error: i18n._('No acknowledgement received. Check the machine and workspace console before retrying.') });
        }
      }, 10000);
      controller.command('macro:run', id, controller.context, (err) => {
        if (this.unmounted) {
          return;
        }
        clearTimeout(this.submitTimeout);
        this.setState({
          pending: false,
          selected: null,
          acknowledged: false,
          error: err ? i18n._('The controller could not start the macro. Check the workspace console.') : '',
          notice: err ? '' : i18n._('Macro submitted. Watch the machine and follow progress in the workspace. Submission does not confirm probing completed.')
        });
      });
    };

    render() {
      const { tab, connected, port, type, machine, settings, macros, loading, error, selected, acknowledged, pending, notice } = this.state;
      const live = this.state.freshReport && connected && !!port && type === 'Grbl';
      const status = live ? get(machine, 'status.activeState', i18n._('Waiting for status')) : i18n._('Disconnected');
      const laserMode = live ? get(settings, 'settings.$32') : undefined;
      const units = Number(get(settings, 'settings.$13')) === 1 ? 'in' : 'mm';
      const operatingMode = Number(laserMode) === 1 ? i18n._('Laser') : i18n._('Milling');
      const preparationTitle = tab === 'bitsetter' ? i18n._('A consistent tool reference') : i18n._('Before the first cut');
      const tabs = [
        ['overview', i18n._('Overview')],
        ['milling', i18n._('Milling')],
        ['bitsetter', i18n._('BitSetter')],
        ['laser', i18n._('Laser')],
        ['camera', i18n._('Camera')]
      ];
      return (
        <div className={styles.shop}>
          <header className={styles.hero}>
            <div>
              <div className={styles.eyebrow}>{i18n._('WORKSHOP / MACHINE 01')}</div>
              <h1>Shapeoko <span>3 XL</span></h1>
              <p>{i18n._('One machine. A place for every workflow.')}</p>
            </div>
            <Link className={styles.primary} to="/workspace">{i18n._('Open machine controls')} <span aria-hidden="true">↗</span></Link>
          </header>
          <nav className={styles.tabs} aria-label={i18n._('Machine workflows')}>
            {tabs.map(([id, label]) => (
              <button
                type="button" key={id} aria-current={tab === id ? 'page' : undefined}
                className={tab === id ? styles.active : ''} onClick={() => this.setState({ tab: id, selected: null, acknowledged: false })}
              >{label}
              </button>
            ))}
          </nav>
          <div className={styles.metrics}>
            <div><span>{i18n._('CONTROLLER')}</span><strong><i className={live ? styles.online : styles.offline} />{status}</strong><small>{live ? port : i18n._('Connect from machine controls')}</small></div>
            <div><span>{i18n._('OPERATING MODE')}</span><strong>{laserMode === undefined ? i18n._('Unknown') : operatingMode}</strong><small>{i18n._('Reported by the controller ($32)')}</small></div>
            <div><span>{i18n._('TOOL SETTING')}</span><strong>BitSetter</strong><small>{i18n._('Saved macros • verify before use')}</small></div>
          </div>
          {tab === 'camera' && <Camera />}
          <section className={styles.panel}>
            <div className={styles.sectionHeading}>
              <h2>{i18n._('Machine readiness')}</h2>
              <span className={styles.tag}>{live ? `Grbl ${settings.version || '—'}` : i18n._('NOT CONNECTED')}</span>
            </div>
            {!live && <p>{i18n._('Open machine controls, select the Shapeoko serial port and connect at 115200 baud. This dashboard never opens a serial port automatically.')}</p>}
            {live && status === 'Alarm' && <p role="status">{i18n._('Controller is locked. With homing enabled, clear the machine and home it from the workspace before setting tools. Unlocking alone does not establish machine coordinates.')}</p>}
            {live && (
              <div>
                <p>{i18n._('Configured travel (X / Y / Z): {{x}} / {{y}} / {{z}} mm.', {
                  x: get(settings, 'settings.$130', '—'), y: get(settings, 'settings.$131', '—'), z: get(settings, 'settings.$132', '—')
                })}
                </p>
                {Number(get(settings, 'settings.$131')) > 500 && <p className={styles.error}>{i18n._('The stored Y travel is unusually large for a Shapeoko 3 XL. Measure usable travel and verify $131 before relying on travel limits. No setting has been changed.')}</p>}
                <p className={styles.muted}>{i18n._('Homing ($22): {{homing}} · Soft limits ($20): {{soft}} · Hard limits ($21): {{hard}}', {
                  homing: get(settings, 'settings.$22', '—'), soft: get(settings, 'settings.$20', '—'), hard: get(settings, 'settings.$21', '—')
                })}
                </p>
              </div>
            )}
          </section>
          {tab !== 'camera' && (
            <div className={styles.columns}>
              <section className={styles.panel}>
                <div className={styles.sectionHeading}><h2>{i18n._('Work position')}</h2><span>{live ? units : '—'}</span></div>
                <div className={styles.coordinates}>
                  {['x', 'y', 'z'].map(axis => {
                    const value = live ? get(machine, ['status', 'wpos', axis]) : undefined;
                    return <div key={axis}><span>{axis.toUpperCase()}</span><strong>{value !== undefined && Number.isFinite(Number(value)) ? Number(value).toFixed(3) : '—'}</strong></div>;
                  })}
                </div>
                <p className={styles.muted}>{i18n._('Live work coordinates. Homing and work zero are separate steps.')}</p>
                <Link className={styles.secondary} to="/workspace">{i18n._('Jog, home & set zero')} <span aria-hidden="true">→</span></Link>
              </section>
              <section className={styles.panel}>
                <div className={styles.sectionHeading}><h2>{tab === 'laser' ? i18n._('J Tech 7W laser setup') : preparationTitle}</h2><span className={styles.tag}>{tab === 'laser' ? i18n._('SETUP REQUIRED') : i18n._('PREPARATION')}</span></div>
                {tab === 'laser' ? (
                  <div>
                    <p>{i18n._('Connect the J Tech driver to the correct PWM and GND pins for your Carbide board revision. Confirm the laser model, mount clearance and focus distance using its instructions.')}</p>
                    <ol className={styles.steps}>
                      <li>{i18n._('Verify the mount, cable routing and full homing clearance with laser power disconnected.')}</li>
                      <li>{i18n._('Confirm enclosure, suitable laser eyewear, ventilation and driver interlock before enabling the laser.')}</li>
                      <li>{i18n._('Read the Grbl version and $30, $31, $32 settings. Match the CAM power scale to $30; use laser mode only on supported firmware.')}</li>
                      <li>{i18n._('Set a laser work origin and focus for this head. Do not run router tool-setting macros with the laser mounted.')}</li>
                    </ol>
                    <a
                      className={styles.secondary} href="https://jtechphotonics.com/?page_id=3145" target="_blank"
                      rel="noopener noreferrer"
                    >{i18n._('J Tech Shapeoko installation guide')} ↗
                    </a>
                  </div>
                ) : (
                  <div>
                    <ol className={styles.steps}>
                      <li><strong>{i18n._('Home the machine.')}</strong> {i18n._('Clear the travel area and establish machine coordinates in the workspace.')}</li>
                      <li><strong>{i18n._('Set the first tool.')}</strong> {i18n._('Verify the saved probe location and clearance, then run Initial Tool Set.')}</li>
                      <li><strong>{i18n._('Set the work origin.')}</strong> {i18n._('Set X, Y and Z for the stock and check the toolpath before starting.')}</li>
                      <li><strong>{i18n._('Keep the reference.')}</strong> {i18n._('Use New Tool Set for subsequent tools only after a successful initial reference in this controller session.')}</li>
                    </ol>
                    <p className={styles.muted}>{i18n._('A reconnect or controller reset requires the reference to be checked again. This dashboard does not infer that a probe succeeded.')}</p>
                  </div>
                )}
              </section>
            </div>
          )}
          {tab === 'laser' ? (
            <section className={styles.panel}>
              <div className={styles.sectionHeading}><h2>{i18n._('Laser readiness')}</h2><span className={styles.tag}>{i18n._('NOT COMMISSIONED')}</span></div>
              <div className={styles.laserSettings}>
                {['$30', '$31', '$32'].map(key => <div key={key}><span>{key}</span><strong>{live ? get(settings, ['settings', key], '—') : '—'}</strong></div>)}
              </div>
              <p>{i18n._('No laser output is enabled by this page. After hardware commissioning, use the workspace to send a laser toolpath. Confirm $32=1 for laser work and restore $32=0 before milling; disconnect and remove the laser as J Tech instructs before using the router.')}</p>
              <Link className={styles.secondary} to="/workspace">{i18n._('Inspect firmware & settings')} →</Link>
            </section>
          ) : tab !== 'camera' && (
            <section className={styles.panel}>
              <div className={styles.sectionHeading}>
                <div>
                  <h2>{i18n._('Tool-setting macros')}</h2>
                  <p className={styles.muted}>{i18n._('Your saved configuration, read directly from cncjs.')}</p>
                </div>
                <button
                  type="button" className={styles.secondary} onClick={this.fetchMacros}
                  disabled={loading}
                >
                  {i18n._('Refresh')}
                </button>
              </div>
              {loading && <p role="status">{i18n._('Loading macros…')}</p>}
              {!loading && macros.length === 0 && <p>{i18n._('No saved macros. Add or restore them in the workspace Macro widget.')}</p>}
              <div className={styles.macroList}>
                {macros.map(macro => (
                  <div key={macro.id}>
                    <div>
                      <strong>{macro.name}</strong>
                      <small>{i18n._('Review commands and machine coordinates before running.')}</small>
                    </div>
                    <button type="button" className={styles.secondary} onClick={() => this.reviewMacro(macro.id)}>
                      {i18n._('Review macro')} →
                    </button>
                  </div>
                ))}
              </div>
              {selected && (
                <div className={styles.review}>
                  <h3>{selected.name}</h3>
                  <textarea
                    readOnly rows="10" aria-label={i18n._('Macro commands')}
                    value={selected.content}
                  />
                  <label>
                    <input type="checkbox" checked={acknowledged} onChange={event => this.setState({ acknowledged: event.target.checked })} />
                    {i18n._('I verified homing, probe position, clearance and the required tool reference. The laser is disconnected and the machine is ready to move.')}
                  </label>
                  <p>{i18n._('Requires an idle Grbl controller in milling mode ($32=0). Use the workspace for paused tool-change workflows.')}</p>
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.secondary}
                      disabled={pending}
                      onClick={() => this.setState({ selected: null, acknowledged: false })}
                    >
                      {i18n._('Cancel')}
                    </button>
                    <button
                      type="button"
                      className={styles.primary}
                      disabled={!this.canRun() || !acknowledged || pending}
                      onClick={this.runMacro}
                    >
                      {pending ? i18n._('Submitting…') : i18n._('Run reviewed macro')}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}
          {error && <p className={styles.error} role="alert">{error}</p>}
          {notice && <p className={styles.notice} role="status">{notice} <Link to="/workspace">{i18n._('Open workspace')}</Link></p>}
          <footer className={styles.footer}><span>SHAPEOKO 3 XL / CNCJS</span><span>{i18n._('Milling · Tool setting · Laser')}</span></footer>
        </div>
      );
    }
}

export default Shop;

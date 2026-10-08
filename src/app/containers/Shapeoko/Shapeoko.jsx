import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import get from 'lodash/get';
import api, { operatorAccess } from 'app/api';
import FabForge from '../FabForge/FabForge';
import AccessPanel from '../OperatorAccess/AccessPanel';
import MachineDrawing from './MachineDrawing';
import MachineControls from './MachineControls';
import Usage from './Usage';
import styles from './index.styl';

const pages = [
  ['/shop', '01', 'Machine overview'],
  ['/fabforge', '02', 'Work queue'],
  ['/milling', '03', 'DWP611 milling'],
  ['/laser', '04', 'J Tech engraving'],
  ['/workspace', '05', 'Machine controls'],
  ['/usage', '06', 'Operator usage'],
];
export default class Shapeoko extends PureComponent {
  static propTypes = {
    access: PropTypes.object,
    error: PropTypes.string,
    onAccessChange: PropTypes.func.isRequired,
    location: PropTypes.object.isRequired,
  };
  state = {
    machines: [],
    orders: [],
    fresh: false,
    error: '',
    camera: false,
    cameraFailed: false,
    frame: 0,
    badge: false,
  };
  componentDidMount() {
    document.title = 'Shapeoko 3 XL · FabForge Workshop';
    this.poll();
  }
  componentWillUnmount() {
    this.unmounted = true;
    clearTimeout(this.timer);
    clearTimeout(this.cameraTimer);
    clearTimeout(this.staleTimer);
  }
  poll = async () => {
    let machineReceivedAt = 0;
    const results = await Promise.allSettled([
      api.controllers.get().then(result => {
 machineReceivedAt = Date.now(); return result;
}),
      api.fabforge('work-orders'),
    ]);
    if (this.unmounted) {
      return;
    }
    this.setState({
      machines: results[0].status === 'fulfilled' ? results[0].value.body : [],
      orders:
        results[1].status === 'fulfilled'
          ? results[1].value.workOrders
          : this.state.orders,
      fresh: results[0].status === 'fulfilled' && Date.now() - machineReceivedAt < 6000,
      error: results.some((result) => result.status === 'rejected')
        ? 'Live updates unavailable. Check the connection.'
        : '',
    });
    clearTimeout(this.staleTimer);
    this.staleTimer = setTimeout(() => {
 if (!this.unmounted) {
 this.setState({ fresh: false });
}
}, Math.max(0, 6000 - (Date.now() - machineReceivedAt)));
    this.timer = setTimeout(this.poll, 4000);
  };
  hold = async () => {
    try {
      await operatorAccess('POST', '/hold');
    } catch (err) {
      this.setState({ error: err.message });
    }
  };
  cameraFrame = () => {
    clearTimeout(this.cameraTimer);
    this.cameraTimer = setTimeout(() => {
      if (!this.unmounted) {
        this.setState({ frame: Date.now() });
      }
    }, 1500);
  };
  render() {
    const { access, location, onAccessChange, error } = this.props;
    const { machines, orders, fresh, camera, cameraFailed, frame, badge } =
      this.state;
    const pathname = location.pathname;
    const laser = pathname === '/laser';
    const operator = !!(access && access.authorized);
    const canOperate = !!(
      access &&
      (!access.enabled || (access.authorized && access.machineAvailable))
    );
    const machine = machines[0];
    const connected = fresh && !!machine;
    const status = connected
      ? get(machine, 'controller.state.status.activeState', 'Connected')
      : 'Disconnected';
    const milling = pathname === '/milling';
    const queue = pathname === '/fabforge';
    const controls = pathname === '/workspace';
    const usage = pathname === '/usage';
    const active = orders.filter(
      (order) => !['complete', 'cancelled'].includes(order.status)
    );
    const title = { '/usage': 'Operator usage', '/fabforge': 'Work queue', '/workspace': 'Machine controls', '/laser': 'Light, precisely placed.', '/milling': 'Make the first cut count.' }[pathname] || 'Your workshop, in view.';
    const eyebrow = { '/laser': 'J TECH PHOTONICS / 7W DIODE', '/milling': 'DEWALT DWP611 / ⅛″ TOOLING', '/fabforge': 'FABFORGE / PRODUCTION' }[pathname] || 'SHAPEOKO 3 XL / MACHINE 01';
    const units = Number(get(machine, 'controller.settings.settings.$13')) === 1 ? 'in' : 'mm';
    return (
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <Link className={styles.brand} to="/shop">
            <span className={styles.brandMark}>
              S<span>3</span>
            </span>
            <span>
              SHAPEOKO<small>XL / FABFORGE WORKSHOP</small>
            </span>
          </Link>
          <div className={styles.topStatus}>
            <i className={connected ? styles.liveDot : styles.dot} />
            {status}
            <span className={styles.divider} />
            {operator ? access.operator.name : 'Observer session'}
          </div>
          <button
            className={styles.badgeButton}
            type="button"
            onClick={() => this.setState({ badge: !badge })}
          >
            {operator ? 'Operator access' : 'Badge in'}{' '}
            <span aria-hidden="true">↗</span>
          </button>
        </header>
        <aside className={styles.sidebar}>
          <div className={styles.navLabel}>WORKSTATION / 01</div>
          <nav aria-label="Shapeoko navigation">
            {pages.map(([to, number, label]) => (
              <Link
                key={to}
                to={to}
                className={pathname === to ? styles.current : ''}
                aria-current={pathname === to ? 'page' : undefined}
              >
                <span>{number}</span>
                {label}
              </Link>
            ))}
          </nav>
          <div className={styles.machineIdentity}>
            <span className={styles.tiny}>MACHINE & ATTACHMENTS</span>
            <strong>Shapeoko 3 XL</strong>
            <p>
              DeWalt DWP611
              <br />J Tech Photonics · 7W
              <br />
              Carbide BitSetter
            </p>
            <span className={styles.restricted}>Commissioning pending</span>
          </div>
          <a
            className={styles.fabLink}
            href="https://fab.forgegraf.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open FabForge <span>↗</span>
          </a>
        </aside>
        <main className={styles.main}>
          {badge && (
            <div className={styles.access}>
              <AccessPanel
                access={access}
                error={error}
                onChange={next => {
 onAccessChange(next); this.setState({ badge: false });
}}
              />
            </div>
          )}
          {(error || this.state.error) && (
            <p role="alert" className={styles.alert}>
              {error || this.state.error}
            </p>
          )}
          <div className={styles.pageHeading}>
            <div>
              <span className={styles.eyebrow}>
                {eyebrow}
              </span>
              <h1>{title}</h1>
            </div>
            <span className={styles.modePill}>
              {operator ? 'OPERATOR' : 'VIEW ONLY'}
            </span>
          </div>
          {queue && (
            <FabForge
              embedded
              key={operator ? 'operator' : 'viewer'}
              canControl={operator || !!(access && !access.enabled)}
              badgeAccess={!!(access && access.enabled)}
              access={access}
              onAccessChange={onAccessChange}
            />
          )}
          {controls && (
            <MachineControls
              key={operator ? access.operator.id : 'viewer'}
              machine={machine}
              fresh={fresh}
              canOperate={canOperate}
              access={access}
            />
          )}
          {usage && <Usage />}
          {!queue && !controls && !usage && (
            <div>
              <div className={styles.heroGrid}>
                <section className={styles.machineCard}>
                  <div className={styles.cardHeading}>
                    <div>
                      <span className={styles.tiny}>
                        {laser
                          ? 'ENGRAVING CONFIGURATION'
                          : 'MILLING CONFIGURATION'}
                      </span>
                      <h2>{laser ? 'J Tech 7W' : 'Shapeoko + DWP611'}</h2>
                    </div>
                    <span className={styles.outlineTag}>
                      {laser ? 'SETUP REQUIRED' : '3 XL'}
                    </span>
                  </div>
                  <MachineDrawing laser={laser} />
                  <div className={styles.machineCaption}>
                    <span>
                      {laser
                        ? 'Diode laser · focus at the work surface'
                        : 'Trim router · manual switch & speed dial'}
                    </span>
                    <span>XL / WIDE BED</span>
                  </div>
                </section>
                <section className={styles.cameraCard}>
                  <div className={styles.cardHeading}>
                    <div>
                      <span className={styles.tiny}>AT THE MACHINE</span>
                      <h2>Live camera</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => this.setState({
                          camera: !camera,
                          cameraFailed: false,
                          frame: Date.now(),
                        })}
                    >
                      {camera ? 'Close' : 'View live'} ↗
                    </button>
                  </div>
                  <div className={styles.cameraViewport}>
                    {camera && !cameraFailed ? (
                      <img
                        alt="Live view of the Shapeoko work area"
                        src={`/camera/?action=snapshot&_=${frame}`}
                        onLoad={this.cameraFrame}
                        onError={() => this.setState({ cameraFailed: true })}
                      />
                    ) : (
                      <div>
                        <span className={styles.cameraIcon} aria-hidden="true">
                          ◎
                        </span>
                        <strong>
                          {cameraFailed
                            ? 'Camera unavailable'
                            : 'A window into the work'}
                        </strong>
                        <p>
                          {cameraFailed
                            ? 'Check the USB camera connection, then reopen the view.'
                            : 'Open the camera to watch the machine from here.'}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className={styles.cameraFooter}>
                    <span>
                      <i
                        className={
                          camera && !cameraFailed ? styles.liveDot : styles.dot
                        }
                      />
                      {camera && !cameraFailed
                        ? 'Snapshot feed · 1.5s refresh'
                        : 'Raspberry Pi USB camera'}
                    </span>
                    <span>VIEW ONLY</span>
                  </div>
                </section>
              </div>
              <section className={styles.telemetry} aria-label="Machine status">
                <div>
                  <span className={styles.tiny}>CONTROLLER</span>
                  <strong>{status}</strong>
                  <small>
                    {connected
                      ? 'Grbl · live report'
                      : 'Awaiting operator connection'}
                  </small>
                </div>
                {['x', 'y', 'z'].map((axis) => (
                  <div key={axis}>
                    <span className={styles.tiny}>
                      WORK {axis.toUpperCase()}
                    </span>
                    <strong className={styles.coordinate}>
                      {connected &&
                      Number.isFinite(
                        Number(
                          get(machine, `controller.state.status.wpos.${axis}`)
                        )
                      )
                        ? Number(
                            get(machine, `controller.state.status.wpos.${axis}`)
                          ).toFixed(3)
                        : '—'}
                      <small>
                        {connected ? units : ''}
                      </small>
                    </strong>
                    <small>Work coordinates</small>
                  </div>
                ))}
              </section>
              {laser || milling ? (
                <section className={styles.workflow}>
                  <div className={styles.sectionTitle}>
                    <div>
                      <span className={styles.eyebrow}>
                        {laser ? 'ENGRAVING WORKFLOW' : 'MILLING WORKFLOW'}
                      </span>
                      <h2>
                        {laser
                          ? 'From installation to engraving'
                          : 'From stock to finished part'}
                      </h2>
                    </div>
                    <Link to="/workspace">Machine controls ↗</Link>
                  </div>
                  <div className={styles.steps}>
                    {(laser
                      ? [
                          [
                            '01',
                            'Install & protect',
                            'Identify the driver and controller revisions before wiring PWM/GND. Verify mount clearance, enclosure, interlock, extraction and suitable eyewear.',
                          ],
                          [
                            '02',
                            'Focus & set origin',
                            'Use the head’s specified focus distance. Set a laser work origin; router BitSetter macros do not establish laser focus.',
                          ],
                          [
                            '03',
                            'Review the engraving',
                            'Review the exact file and CAM power scale. Verify laser mode and the controller’s maximum S value before a commissioned run.',
                          ],
                          [
                            '04',
                            'Release, then start',
                            'An authorized operator releases the job for setup. Enable the installed laser only after physical checks; starting is a separate action.',
                          ],
                        ]
                      : [
                          [
                            '01',
                            'Fit the cutting tool',
                            'Unplug the DWP611. Use a compatible precision ⅛″ collet for your ⅛″ shank bit. Seat and tighten per the router and collet instructions.',
                          ],
                          [
                            '02',
                            'Establish the reference',
                            'After homing is commissioned, verify the saved BitSetter location and clearance. Review Initial Tool Set before running it.',
                          ],
                          [
                            '03',
                            'Secure stock & zero',
                            'Check clamps and travel clearance. Set the work origin for the CAM setup; review the exact toolpath and tool choice.',
                          ],
                          [
                            '04',
                            'Switch on & cut',
                            'Set router speed on the DWP611 dial and switch it on manually. Release and load the reviewed job, then press Start separately.',
                          ],
                        ]
                    ).map(([number, heading, copy]) => (
                      <article key={number}>
                        <span className={styles.stepNumber}>{number}</span>
                        <h3>{heading}</h3>
                        <p>{copy}</p>
                      </article>
                    ))}
                  </div>
                  {laser && (
                  <div className={styles.laserParameters}>
                    {[['$30', 'Maximum power scale'], ['$31', 'Minimum power scale'], ['$32', 'Laser mode · 1 = enabled']].map(([key, label]) => <div key={key}><span>{label}</span><strong>{connected ? get(machine, ['controller', 'settings', 'settings', key], '—') : '—'}</strong><small>Reported {key} · read only</small></div>)}
                  </div>
)}
                  <div className={styles.workflowNote}>
                    <strong>
                      {laser
                        ? 'Laser output remains uncommissioned.'
                        : 'The DWP611 is manually controlled.'}
                    </strong>
                    <span>
                      {laser
                        ? 'Selecting this page does not change Grbl mode or energize the laser.'
                        : 'M3/M5 do not switch the router without a separately installed and verified relay. The software cannot set its RPM.'}
                    </span>
                    {laser && (
                      <a
                        href="https://jtechphotonics.com/?page_id=3145"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Installation guide ↗
                      </a>
                    )}
                  </div>
                </section>
              ) : (
                <div className={styles.bottomGrid}>
                  <section className={styles.queueSummary}>
                    <div className={styles.sectionTitle}>
                      <div>
                        <span className={styles.eyebrow}>UP NEXT</span>
                        <h2>
                          Work queue{' '}
                          <span className={styles.count}>{active.length}</span>
                        </h2>
                      </div>
                      <Link to="/fabforge">View queue ↗</Link>
                    </div>
                    {active.length ? (
                      active.slice(0, 4).map((order) => (
                        <Link
                          className={styles.queueRow}
                          key={order.id}
                          to="/fabforge"
                        >
                          <span>{order.title}</span>
                          <small>{order.status}</small>
                          <span>↗</span>
                        </Link>
                      ))
                    ) : (
                      <div className={styles.emptyQueue}>
                        <span aria-hidden="true">≡</span>
                        <div>
                          <strong>Room for your next project.</strong>
                          <p>
                            Work orders from Graham Mackie’s workspace will
                            appear here.
                          </p>
                        </div>
                      </div>
                    )}
                  </section>
                  <section className={styles.readiness}>
                    <span className={styles.eyebrow}>BEFORE PRODUCTION</span>
                    <h2>Make ready. Then make.</h2>
                    <p>
                      Homing and XL travel verification, BitSetter calibration,
                      and laser installation are still pending.
                    </p>
                    <div>
                      <Link to="/milling">Milling setup ↗</Link>
                      <Link to="/laser">Laser setup ↗</Link>
                    </div>
                  </section>
                </div>
              )}
            </div>
          )}
          <footer className={styles.footer}>
            <span>
              SHAPEOKO 3 XL <span> / </span> FABFORGE CONNECTED WORKSHOP
            </span>
            <button type="button" onClick={this.hold}>
              Ⅱ Feed hold
            </button>
            <span>Feed hold is not an emergency stop.</span>
          </footer>
        </main>
      </div>
    );
  }
}

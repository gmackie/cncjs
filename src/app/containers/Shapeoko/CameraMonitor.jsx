import React, { PureComponent } from 'react';
import styles from './index.styl';

export default class CameraMonitor extends PureComponent {
  state = { enabled: true, status: 'loading', frame: 0, receivedAt: null };
  componentDidMount() {
    document.addEventListener('visibilitychange', this.visibilityChanged);
    this.visibilityChanged();
  }
  componentWillUnmount() {
    this.unmounted = true;
    this.clearTimers();
    document.removeEventListener('visibilitychange', this.visibilityChanged);
  }
  clearTimers = () => {
    clearTimeout(this.refreshTimer);
    clearTimeout(this.timeout);
  };
  visibilityChanged = () => {
    if (!this.state.enabled) {
      return;
    }
    this.clearTimers();
    if (document.hidden) {
      this.setState({ status: 'paused', frame: 0 });
    } else {
      this.load();
    }
  };
  load = () => {
    this.clearTimers();
    if (this.unmounted) {
      return;
    }
    this.setState({ enabled: true, status: 'loading', frame: Date.now() });
    this.timeout = setTimeout(this.failed, 8000);
  };
  received = () => {
    if (!this.state.enabled || !this.state.frame || this.unmounted) {
      return;
    }
    clearTimeout(this.timeout);
    this.setState({ status: 'live', receivedAt: new Date().toLocaleTimeString() });
    this.refreshTimer = setTimeout(this.load, 1500);
  };
  failed = () => {
    this.clearTimers();
    if (!this.unmounted) {
      this.setState({ status: 'error', frame: 0, receivedAt: null });
      if (this.state.enabled && !document.hidden) {
        this.refreshTimer = setTimeout(this.load, 5000);
      }
    }
  };
  stop = () => {
    this.clearTimers();
    this.setState({ enabled: false, status: 'off', frame: 0, receivedAt: null });
  };
  render() {
    const { enabled, status, frame, receivedAt } = this.state;
    const healthy = status === 'live' || (status === 'loading' && receivedAt);
    const labels = { off: 'Camera preview is off', loading: 'Connecting to the camera…', paused: 'Preview paused', error: 'Camera unavailable' };
    return (
      <section className={styles.cameraCard} aria-label="Machine camera">
        <div className={styles.cardHeading}>
          <div><span className={styles.tiny}>AT THE MACHINE</span><h2>Work area camera</h2></div>
          <button type="button" onClick={enabled ? this.stop : this.load}>{enabled ? 'Close preview' : 'Open preview'}</button>
        </div>
        <div className={styles.cameraViewport}>
          {!!frame && (
          <img
            key={frame} alt="Latest camera snapshot of the Shapeoko work area" src={`/camera/?action=snapshot&_=${frame}`}
            onLoad={this.received} onError={this.failed}
          />
)}
          {!frame && (
          <div>
            <span className={styles.cameraIcon} aria-hidden="true">◎</span>
            <strong>{labels[status]}</strong>
            <p>{{ error: 'Check camera power and USB connection. Retrying automatically every 5 seconds.', paused: 'The preview resumes when you return to this screen.' }[status] || 'View the work area without enabling machine controls.'}</p>
            {status === 'error' && <button type="button" onClick={this.load}>Retry camera</button>}
          </div>
)}
        </div>
        <div className={styles.cameraFooter}>
          <span><i className={healthy ? styles.liveDot : styles.dot} />{healthy ? `Last image ${receivedAt}` : labels[status]}</span>
          <span>VIEW ONLY</span>
        </div>
        <p className={styles.cameraHint}>Snapshots refresh every 1.5 seconds. Keep the work area lit; camera images do not confirm machine readiness.</p>
      </section>
    );
  }
}

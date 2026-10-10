import React, { PureComponent } from 'react';
import i18n from 'app/lib/i18n';
import styles from './index.styl';

class Camera extends PureComponent {
    state = { enabled: false, frame: '', status: 'off', receivedAt: '' };

    componentWillUnmount() {
      clearTimeout(this.refreshTimer);
      clearTimeout(this.timeout);
    }

    loadFrame = () => {
      clearTimeout(this.refreshTimer);
      clearTimeout(this.timeout);
      this.setState({ enabled: true, status: 'loading', frame: `camera/?action=snapshot&_=${Date.now()}` });
      this.timeout = setTimeout(this.unavailable, 5000);
    };

    received = () => {
      clearTimeout(this.timeout);
      this.setState({ status: 'live', receivedAt: new Date().toLocaleTimeString() });
      this.refreshTimer = setTimeout(this.loadFrame, 1500);
    };

    unavailable = () => {
      clearTimeout(this.timeout);
      clearTimeout(this.refreshTimer);
      this.setState({ frame: '', status: 'unavailable', receivedAt: '' });
    };

    stop = () => {
      clearTimeout(this.timeout);
      clearTimeout(this.refreshTimer);
      this.setState({ enabled: false, frame: '', status: 'off', receivedAt: '' });
    };

    render() {
      const { enabled, frame, status, receivedAt } = this.state;
      return (
        <section className={styles.panel}>
          <div className={styles.sectionHeading}>
            <div>
              <h2>{i18n._('Machine camera')}</h2>
              <p className={styles.muted}>{i18n._('USB camera connected to the Raspberry Pi')}</p>
            </div>
            <button type="button" className={styles.secondary} onClick={enabled ? this.stop : this.loadFrame}>
              {enabled ? i18n._('Turn camera off') : i18n._('Show camera')}
            </button>
          </div>
          <div className={styles.cameraFrame}>
            {frame && (
            <img
              src={frame} alt={i18n._('Latest view of the Shapeoko work area')} onLoad={this.received}
              onError={this.unavailable}
            />
)}
            {status === 'off' && <p>{i18n._('Camera is off. Connect a USB webcam to the Pi, then select Show camera.')}</p>}
            {status === 'unavailable' && (
              <div role="status">
                <p>{i18n._('No camera image received. Check the USB connection and camera service, then retry.')}</p>
                <button type="button" className={styles.secondary} onClick={this.loadFrame}>{i18n._('Retry camera')}</button>
              </div>
            )}
          </div>
          <p className={styles.muted} role="status">
            {status === 'loading' && i18n._('Waiting for the next camera frame…')}
            {status === 'live' && i18n._('Last frame received at {{time}}. Images refresh every 1.5 seconds.', { time: receivedAt })}
          </p>
          <p>{i18n._('For continuous video, use the Webcam widget, select Raspberry Pi USB camera, and enable it. Camera viewing does not move the machine.')}</p>
        </section>
      );
    }
}

export default Camera;

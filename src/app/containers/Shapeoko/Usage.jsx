import React, { PureComponent } from 'react';
import { operatorAccess } from 'app/api';
import styles from './index.styl';

export default class Usage extends PureComponent {
  state = { events: [], synchronization: {}, error: '', truncated: false };
  componentDidMount() {
 this.refresh(); this.timer = setInterval(this.refresh, 30000);
}
  componentWillUnmount() {
 this.unmounted = true; clearInterval(this.timer);
}
  refresh = async () => {
    try {
      const result = await operatorAccess('GET', '/usage');
      if (!this.unmounted) {
 this.setState({ ...result, error: '' });
}
    } catch (err) {
 if (!this.unmounted) {
 this.setState({ error: err.message });
}
}
  };
  render() {
    const { events, synchronization, error, truncated } = this.state;
    const ended = events.filter(event => event.type === 'session_ended');
    const minutes = Math.round(ended.reduce((total, event) => total + (event.durationMs || 0), 0) / 60000);
    const uploadStatus = synchronization.lastSuccess ? `last checked ${new Date(synchronization.lastSuccess).toLocaleString()}` : 'waiting for first upload';
    return (
      <section className={styles.panel}>
        <h2>Operator usage</h2>
        <p>{ended.length} ended sessions · {minutes} minutes of badge access in this view. Access time is not cutting time.</p>
        <p>FabForge upload: {synchronization.enabled ? uploadStatus : 'not enabled on this server'}.</p>
        {synchronization.error && <p role="alert">Upload pending: {synchronization.error}</p>}
        {error && <p role="alert">{error}</p>}
        <button type="button" onClick={this.refresh}>Refresh usage</button>
        <p>Latest {events.length} events{truncated ? ' · older records retained in the journal' : ''}. Unmatched session starts may represent an active session or an interrupted shutdown.</p>
        {!events.length && <p>No recorded operator activity.</p>}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left' }}>
            <thead><tr><th>Time</th><th>Activity</th><th>Operator</th><th>Job / command</th></tr></thead>
            <tbody>{events.map((event, index) => (
              <tr key={event.eventId || index}>
                <td style={{ padding: '10px 8px' }}>{new Date(event.at).toLocaleString()}</td>
                <td>{event.type.replace(/_/g, ' ')}</td><td>{event.operatorId || '—'}</td><td>{event.jobId || event.command || '—'}</td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }
}

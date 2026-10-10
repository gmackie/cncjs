import React, { PureComponent } from 'react';
import api from 'app/api';
import styles from './index.styl';

export default class MachineStatus extends PureComponent {
  state = { controllers: [], error: '' };
  componentDidMount() {
    this.refresh();
  }
  componentWillUnmount() {
    this.unmounted = true;
    clearTimeout(this.timer);
  }
  refresh = async () => {
    try {
      const response = await api.controllers.get();
      if (!this.unmounted) {
        this.setState({ controllers: response.body, error: '' });
      }
    } catch (err) {
      if (!this.unmounted) {
        this.setState({
          controllers: [],
          error: 'Machine status unavailable.',
        });
      }
    } finally {
      if (!this.unmounted) {
        this.timer = setTimeout(this.refresh, 3000);
      }
    }
  };
  render() {
    return (
      <section className={styles.panel} aria-label="Machine activity">
        {this.state.error && <span role="status">{this.state.error}</span>}
        {!this.state.error && !this.state.controllers.length && (
          <span>Controller disconnected · queue viewing available</span>
        )}
        {this.state.controllers.map((item) => (
          <div key={item.port}>
            <strong>
              {item.port} · {item.workflow && item.workflow.state}
            </strong>
            <p>
              {item.sender && item.sender.name
                ? item.sender.name
                : 'No loaded file'}
            </p>
          </div>
        ))}
      </section>
    );
  }
}

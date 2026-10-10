import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { operatorAccess } from 'app/api';
import { setOperatorToken } from 'app/lib/operator-access';
import styles from './index.styl';

export default class AccessPanel extends PureComponent {
  static propTypes = {
    access: PropTypes.object,
    onChange: PropTypes.func.isRequired,
    error: PropTypes.string,
  };
  state = { badge: '', error: '', busy: false };
  perform = async (action) => {
    this.setState({ busy: true, error: '' });
    try {
      await action();
    } catch (err) {
      this.setState({ error: err.message });
    } finally {
      this.setState({ busy: false, badge: '' });
    }
  };
  badgeIn = (event) => {
    event.preventDefault();
    const badge = this.state.badge;
    this.setState({ badge: '' });
    this.perform(async () => {
      const result = await operatorAccess('POST', '/session', { badge });
      setOperatorToken(result.token);
      this.props.onChange(result);
    });
  };
  badgeOut = () => this.perform(async () => {
      const result = await operatorAccess('DELETE', '/session');
      setOperatorToken('');
      this.props.onChange(result);
    });
  render() {
    const { access, error } = this.props;
    const authorized = access && access.authorized;
    return (
      <section className={styles.panel} aria-label="Machine access">
        <div>
          <strong>
            {authorized ? `Operator · ${access.operator.name}` : 'Viewer mode'}
          </strong>
          <p>
            {authorized
              ? `Access ends ${new Date(
                  access.expiresAt
                ).toLocaleTimeString()}. Badge out when finished.`
              : 'Watch the queue and camera. Badge in to release work for setup and use machine controls.'}
          </p>
          {access && access.operator && !authorized && (
            <p>In use by {access.operator.name}.</p>
          )}
          {authorized && !access.machineAvailable && (
            <p>
              Machine restricted in FabForge. Production is locked. Authorized setup controls are on the Commissioning page.
            </p>
          )}
        </div>
        {authorized ? (
          <button
            type="button"
            disabled={this.state.busy}
            onClick={this.badgeOut}
          >
            Badge out · lock controls
          </button>
        ) : (
          <form onSubmit={this.badgeIn}>
            <label htmlFor="operator-badge">Scan badge</label>
            <input
              id="operator-badge"
              type="password"
              autoComplete="off"
              maxLength={128}
              placeholder="Click here, then scan"
              value={this.state.badge}
              onChange={(event) => this.setState({ badge: event.target.value })}
              disabled={this.state.busy || !access || !!access.operator}
            />
            <button
              type="submit"
              disabled={this.state.busy || !this.state.badge}
            >
              Badge in
            </button>
          </form>
        )}
        <button
          type="button"
          onClick={() => this.perform(() => operatorAccess('POST', '/hold'))}
        >
          Feed hold
        </button>
        {(error || this.state.error) && (
          <p role="alert">{error || this.state.error}</p>
        )}
      </section>
    );
  }
}

import React, { PureComponent } from 'react';
import { Redirect, withRouter } from 'react-router-dom';
import { operatorAccess } from 'app/api';
import { trackPage } from '../lib/analytics';
import Header from './Header';
import Sidebar from './Sidebar';
import Workspace from './Workspace';
import Settings from './Settings';
import FabForge from './FabForge/FabForge';
import Shop from './Shop/Shop';
import styles from './App.styl';
import AccessPanel from './OperatorAccess/AccessPanel';
import Camera from './Shop/Camera';
import MachineStatus from './OperatorAccess/MachineStatus';

class App extends PureComponent {
    static propTypes = {
      ...withRouter.propTypes
    };

    state = { access: null, accessError: '' };

    componentDidMount() {
 this.refreshAccess();
}
    componentWillUnmount() {
 this.unmounted = true; clearTimeout(this.accessTimer);
}
    refreshAccess = async () => {
      try {
        const access = await operatorAccess();
        if (!this.unmounted) {
 this.setState({ access, accessError: '' });
}
      } catch (err) {
        if (!this.unmounted) {
 this.setState({ access: null, accessError: err.message });
}
      } finally {
        if (!this.unmounted) {
 this.accessTimer = setTimeout(this.refreshAccess, 5000);
}
      }
    };
    render() {
      const { location } = this.props;
      const { access, accessError } = this.state;
      const canControl = !!(access && (!access.enabled || access.authorized));
      const canOperate = canControl && (!access.enabled || access.machineAvailable);
      const canAdmin = canControl && !access.enabled;
      const accepted = ([
        '/shop',
        '/fabforge',
        '/workspace',
        '/settings',
        '/settings/general',
        '/settings/workspace',
        '/settings/machine-profiles',
        '/settings/user-accounts',
        '/settings/controller',
        '/settings/commands',
        '/settings/events',
        '/settings/about'
      ].indexOf(location.pathname) >= 0);

      if (!accepted) {
        return (
          <Redirect
            to={{
              pathname: '/fabforge',
              state: {
                from: location
              }
            }}
          />
        );
      }

      trackPage(location.pathname);

      return (
        <div>
          <Header {...this.props} canControl={canOperate} />
          <aside className={styles.sidebar} id="sidebar">
            <Sidebar {...this.props} canControl={canOperate} canAdmin={canAdmin} />
          </aside>
          <div role="main" className={styles.main} style={['/shop', '/fabforge'].includes(location.pathname) ? { minWidth: 0 } : undefined}>
            <div className={styles.content}>
              {(!access || access.enabled) && (
              <AccessPanel
                access={access} error={accessError}
                onChange={next => this.setState({ access: next, accessError: '' })}
              />
)}
              {!canOperate && <MachineStatus />}
              {canOperate && (
              <Workspace
                {...this.props}
                style={{
                  display: (location.pathname !== '/workspace') ? 'none' : 'block'
                }}
              />
)}
              {location.pathname === '/shop' && (canOperate ? <Shop /> : <Camera />)}
              {(location.pathname === '/fabforge' || (!canOperate && location.pathname !== '/shop')) && (
                <FabForge
                  key={canControl ? 'operator' : 'viewer'}
                  canControl={canControl} badgeAccess={!!(access && access.enabled)} access={access}
                  onAccessChange={next => this.setState({ access: next })}
                />
              )}
              {canAdmin && location.pathname.indexOf('/settings') === 0 &&
                <Settings {...this.props} />}
            </div>
          </div>
        </div>
      );
    }
}

export default withRouter(App);

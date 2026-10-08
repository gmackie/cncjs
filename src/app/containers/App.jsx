import React, { PureComponent } from 'react';
import { Redirect, withRouter } from 'react-router-dom';
import { trackPage } from '../lib/analytics';
import Header from './Header';
import Sidebar from './Sidebar';
import Workspace from './Workspace';
import Settings from './Settings';
import Shop from './Shop/Shop';
import styles from './App.styl';

class App extends PureComponent {
    static propTypes = {
      ...withRouter.propTypes
    };

    render() {
      const { location } = this.props;
      const accepted = ([
        '/shop',
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
              pathname: '/shop',
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
          <Header {...this.props} />
          <aside className={styles.sidebar} id="sidebar">
            <Sidebar {...this.props} />
          </aside>
          <div role="main" className={styles.main} style={location.pathname === '/shop' ? { minWidth: 0 } : undefined}>
            <div className={styles.content}>
              <Workspace
                {...this.props}
                style={{
                  display: (location.pathname !== '/workspace') ? 'none' : 'block'
                }}
              />
              {location.pathname === '/shop' && <Shop />}
              {location.pathname.indexOf('/settings') === 0 &&
                <Settings {...this.props} />}
            </div>
          </div>
        </div>
      );
    }
}

export default withRouter(App);

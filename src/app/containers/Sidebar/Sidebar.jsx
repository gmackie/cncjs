import classNames from 'classnames';
import PropTypes from 'prop-types';
import React, { PureComponent } from 'react';
import { Link, withRouter } from 'react-router-dom';
import i18n from 'app/lib/i18n';
import styles from './index.styl';

class Sidebar extends PureComponent {
    static propTypes = {
      ...withRouter.propTypes,
      canControl: PropTypes.bool,
      canAdmin: PropTypes.bool
    };

    render() {
      const { pathname = '' } = this.props.location;

      return (
        <nav aria-label="Main navigation" className={styles.navbar}>
          <ul className={styles.nav}>
            <li className={classNames('text-center', { [styles.active]: pathname === '/fabforge' })}>
              <Link aria-label="FabForge queue" to="/fabforge" title="FabForge queue">
                <i aria-hidden="true" className="fa fa-list-alt" style={{ fontSize: 22, padding: '16px 0', color: '#fff' }} />
              </Link>
            </li>
            <li className={classNames('text-center', { [styles.active]: pathname === '/shop' })}>
              <Link aria-label={i18n._('Shop dashboard')} to="/shop" title={i18n._('Shop dashboard')}>
                <i aria-hidden="true" className="fa fa-th-large" style={{ fontSize: 22, padding: '16px 0', color: '#fff' }} />
              </Link>
            </li>
            {this.props.canControl && (
            <li
              className={classNames(
                'text-center',
                { [styles.active]: pathname.indexOf('/workspace') === 0 }
              )}
            >
              <Link aria-label="Workspace" to="/workspace" title={i18n._('Workspace')}>
                <i
                  aria-hidden="true"
                  className={classNames(
                    styles.icon,
                    styles.iconInvert,
                    styles.iconXyz
                  )}
                />
              </Link>
            </li>
)}
            {this.props.canAdmin && (
            <li
              className={classNames(
                'text-center',
                { [styles.active]: pathname.indexOf('/settings') === 0 }
              )}
            >
              <Link aria-label="Settings" to="/settings" title={i18n._('Settings')}>
                <i
                  aria-hidden="true"
                  className={classNames(
                    styles.icon,
                    styles.iconInvert,
                    styles.iconGear
                  )}
                />
              </Link>
            </li>
)}
          </ul>
        </nav>
      );
    }
}

export default withRouter(Sidebar);

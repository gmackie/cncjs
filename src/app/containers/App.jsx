import React, { PureComponent } from 'react';
import { withRouter } from 'react-router-dom';
import { operatorAccess } from 'app/api';
import Shapeoko from './Shapeoko/Shapeoko';

class App extends PureComponent {
  static propTypes = {
    ...withRouter.propTypes,
  };

  state = { access: null, accessError: '' };

  componentDidMount() {
    this.refreshAccess();
  }
  componentWillUnmount() {
    this.unmounted = true;
    clearTimeout(this.accessTimer);
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
    return (
      <Shapeoko
        location={this.props.location}
        access={this.state.access}
        error={this.state.accessError}
        onAccessChange={(access) => this.setState({ access, accessError: '' })}
      />
    );
  }
}

export default withRouter(App);

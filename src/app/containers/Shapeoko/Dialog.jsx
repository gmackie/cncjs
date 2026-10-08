import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import styles from './index.styl';

export default class Dialog extends PureComponent {
  static propTypes = {
    label: PropTypes.string.isRequired,
    onClose: PropTypes.func.isRequired,
    children: PropTypes.node,
  };
  componentDidMount() {
    this.previous = document.activeElement;
    this.panel.focus();
    document.addEventListener('keydown', this.key, true);
  }
  componentWillUnmount() {
    document.removeEventListener('keydown', this.key, true);
    if (this.previous && document.contains(this.previous)) {
      this.previous.focus();
    }
  }
  key = (event) => {
    if (event.key === 'Escape') {
      this.props.onClose();
    }
    if (event.key !== 'Tab') {
      return;
    }
    const items = Array.from(
      this.panel.querySelectorAll(
        'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]'
      )
    );
    const first = items[0];
    const last = items[items.length - 1];
    if (!first) {
      event.preventDefault();
      return;
    }
    if (
      event.shiftKey &&
      [first, this.panel].includes(document.activeElement)
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      [last, this.panel].includes(document.activeElement)
    ) {
      event.preventDefault();
      first.focus();
    }
  };
  render() {
    return (
      <div className={styles.dialogLayer}>
        <section
          className={styles.confirm}
          role="dialog"
          aria-modal="true"
          aria-label={this.props.label}
          tabIndex={-1}
          ref={(node) => {
            this.panel = node;
          }}
        >
          {this.props.children}
        </section>
      </div>
    );
  }
}

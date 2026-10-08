import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { operatorAccess } from 'app/api';
import styles from './index.styl';

export default class ProductionReport extends PureComponent {
  static propTypes = {
    workOrderId: PropTypes.string.isRequired,
    job: PropTypes.object.isRequired,
    access: PropTypes.object,
    onSaved: PropTypes.func.isRequired
  };
  state = { outcome: 'accepted', quantity: '1', note: '', confirmed: false, busy: false, saved: false, error: '' };
  componentWillUnmount() {
    this.unmounted = true;
  }
  save = async () => {
    if (this.state.busy || this.state.saved) {
      return;
    }
    this.setState({ busy: true, error: '' });
    try {
      await operatorAccess('POST', '/production-records', {
        workOrderId: this.props.workOrderId,
        jobId: this.props.job.id,
        outcome: this.state.outcome,
        quantity: Number(this.state.quantity),
        note: this.state.note,
        confirmed: this.state.confirmed
      });
      if (!this.unmounted) {
        this.setState({ saved: true });
        this.props.onSaved();
      }
    } catch (err) {
      if (!this.unmounted) {
        this.setState({ error: `${err.message} Check production history before retrying; the report may have reached FabForge.` });
      }
    } finally {
      if (!this.unmounted) {
        this.setState({ busy: false });
      }
    }
  };
  render() {
    const { access, job, workOrderId } = this.props;
    const { busy, saved, error, outcome, quantity, note, confirmed } = this.state;
    const release = access && access.release;
    const allowed = access && access.authorized && release && release.jobId === job.id && release.workOrderId === workOrderId;
    const count = Number(quantity);
    return (
      <section className={styles.card}>
        <h2>Report physical output</h2>
        <p>After inspecting the parts, send a draft production record to FabForge. Acceptance and job completion happen there.</p>
        {!allowed && <p>Badge in and release this job for setup to report its output.</p>}
        {saved && <p role="status">Draft saved in FabForge. Review and accept it there when quality checks are complete.</p>}
        {error && <p role="alert" className={styles.error}>{error}</p>}
        <fieldset disabled={!allowed || busy || saved}>
          <legend>Operator report · {job.title}</legend>
          <div className={styles.fields}>
            <label>
              Observed outcome
              <select value={outcome} onChange={e => this.setState({ outcome: e.target.value })}>
                <option value="accepted">Parts meet requirements</option>
                <option value="rework_required">Rework needed</option>
                <option value="scrapped">Scrapped parts</option>
              </select>
            </label>
            <label>
              Quantity (each)
              <input
                type="number" min="1" max="100000"
                step="1" value={quantity} onChange={e => this.setState({ quantity: e.target.value })}
              />
            </label>
          </div>
          <label>
            Inspection and run notes
            <textarea maxLength={4000} value={note} onChange={e => this.setState({ note: e.target.value })} />
          </label>
          <label className={styles.check}>
            <input type="checkbox" checked={confirmed} onChange={e => this.setState({ confirmed: e.target.checked })} />
            I inspected the physical output from this job. This is an operator report, not a simulated result.
          </label>
          <button type="button" onClick={this.save} disabled={!confirmed || note.trim().length < 3 || !Number.isSafeInteger(count) || count < 1 || count > 100000}>
            {busy ? 'Saving draft…' : 'Save draft production record'}
          </button>
          {release && allowed && <p>Released G-code: <code>{release.sha256}</code></p>}
        </fieldset>
      </section>
    );
  }
}

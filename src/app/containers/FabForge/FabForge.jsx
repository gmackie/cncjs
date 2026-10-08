import PropTypes from 'prop-types';
import api, { operatorAccess } from 'app/api';
import React, { PureComponent } from 'react';
import { Link } from 'react-router-dom';
import Toolpath from './Toolpath';
import ProductionPacket from './ProductionPacket';
import styles from './index.styl';

const pretty = (value) => JSON.stringify(value, null, 2);
const jobPath = (order, job) => `work-orders/${encodeURIComponent(order)}/jobs/${encodeURIComponent(job)}`;

export default class FabForge extends PureComponent {
  static propTypes = { canControl: PropTypes.bool, badgeAccess: PropTypes.bool, access: PropTypes.object, onAccessChange: PropTypes.func };
  static defaultProps = { canControl: false };
  state = {
    config: null,
    orders: [],
    detail: null,
    job: null,
    review: null,
    busy: false,
    error: '',
    notice: '',
    sourceType: 'artifact',
    candidate: '',
    artifactId: '',
    owner: '',
    repo: '',
    path: '',
    ref: '',
    notes: '',
    acknowledged: false,
    decision: 'reviewed',
    disposition: 'retry_required',
    filter: 'active',
    played: false
  };

  componentDidMount() {
    this.refresh();
    this.queueTimer = setInterval(this.pollQueue, 15000);
  }
  componentWillUnmount() {
    this.unmounted = true;
    clearInterval(this.queueTimer);
  }
  pollQueue = async () => {
    if (this.state.busy || !this.state.config || !this.state.config.configured) {
 return;
}
    try {
      const result = await api.fabforge('work-orders');
      this.update({ orders: result.workOrders });
    } catch (err) {
 this.update({ error: 'Queue refresh failed. Displayed work may be out of date.' });
}
  };
  release = () => this.perform(async () => {
    const { detail, job, review } = this.state;
    const access = await operatorAccess('POST', '/release', {
      workOrderId: detail.workOrder.id, jobId: job.id, source: review.source, hash: review.hash
    });
    this.props.onAccessChange(access);
    this.update({ notice: 'Released for setup. Load the reviewed file and start separately after physical checks.' });
  });
  perform = async (action) => {
    this.setState({ busy: true, error: '', notice: '' });
    try {
      await action();
    } catch (err) {
      if (!this.unmounted) {
        this.setState({ error: err.message });
      }
    } finally {
      if (!this.unmounted) {
        this.setState({ busy: false });
      }
    }
  };
  update = (state) => {
    if (!this.unmounted) {
      this.setState(state);
    }
  };
  refresh = () => this.perform(async () => {
      const config = await api.fabforge('status');
      this.update({ config, detail: null, job: null, review: null, orders: [] });
      if (config.configured) {
        const result = await api.fabforge('work-orders');
        this.update({ orders: result.workOrders });
      }
    });
  open = (id) => this.perform(async () => {
      this.update({ detail: null, job: null, review: null });
      const detail = await api.fabforge(`work-orders/${encodeURIComponent(id)}`);
      this.update({ detail });
    });
  selectJob = (job) => {
    this.setState({
      job,
      review: null,
      notes: '',
      acknowledged: false,
      played: false,
      notice: '',
      error: '',
      candidate: ''
    });
    const direct = job.sourceRef && !Array.isArray(job.sourceRef) ? job.sourceRef : {};
    this.applySource(direct);
  };
  applySource = (source = {}, candidate = '') => {
    this.setState({
      candidate,
      review: null,
      acknowledged: false,
      played: false,
      sourceType: source.artifactId ? 'artifact' : 'repo',
      artifactId: typeof source.artifactId === 'string' ? source.artifactId : '',
      owner: typeof source.owner === 'string' ? source.owner : '',
      repo: typeof source.repo === 'string' ? source.repo : '',
      path: typeof source.path === 'string' ? source.path : '',
      ref: typeof source.ref === 'string' ? source.ref : ''
    });
  };
  importGcode = () => this.perform(async () => {
      this.update({ review: null, acknowledged: false, played: false });
      const { detail, job, sourceType, artifactId, owner, repo, path, ref } = this.state;
      const source = sourceType === 'artifact' ? { artifactId } : { owner, repo, path, ref };
      const review = await api.fabforge(jobPath(detail.workOrder.id, job.id) + '/review', { source });
      this.update({ review });
    });
  saveReview = () => this.perform(async () => {
      const { detail, job, review, notes, decision } = this.state;
      await api.fabforge(jobPath(detail.workOrder.id, job.id) + '/validations', {
        source: review.source,
        hash: review.hash,
        notes,
        decision
      });
      const updated = await api.fabforge(`work-orders/${encodeURIComponent(detail.workOrder.id)}`);
      this.update({
        detail: updated,
        review: null,
        acknowledged: false,
        notice:
          decision === 'changes_requested'
            ? 'Changes requested. FabForge records a failed validation and blocks the work order.'
            : 'Review recorded with the G-code hash. Physical setup and commissioning remain separate.'
      });
    });
  manage = () => this.perform(async () => {
      const { detail, job, disposition, notes } = this.state;
      await api.fabforge(jobPath(detail.workOrder.id, job.id) + '/disposition', { disposition, reason: notes });
      const updated = await api.fabforge(`work-orders/${encodeURIComponent(detail.workOrder.id)}`);
      this.update({ detail: updated, job: null, review: null, notice: 'Queue disposition saved in FabForge.' });
    });
  download = () => {
    const blob = new Blob([this.state.review.gcode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `review-${this.state.review.hash.slice(0, 12)}.nc`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  render() {
    const { canControl, badgeAccess, access } = this.props;
    const { config, orders, detail, job, review, busy, error, notice, filter } = this.state;
    const visible = orders.filter((order) => filter === 'all' || !['complete', 'cancelled'].includes(order.status));
    const jobs = detail
      ? detail.jobs
          .filter(
            (item) => ['cnc', 'laser_cut'].includes(item.processType) &&
              (!config.resourceId || item.resourceId === config.resourceId)
          )
          .sort(
            (a, b) => (a.queuePosition == null ? Infinity : a.queuePosition) -
              (b.queuePosition == null ? Infinity : b.queuePosition)
          )
      : [];
    const analysis = review && review.analysis;
    return (
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <div className={styles.eyebrow}>FABFORGE / SHOP FLOOR</div>
            <h1>{canControl ? 'Queue & toolpath review' : 'Machine queue'}</h1>
            <p>{canControl ? 'Review the production packet, play the toolpath, and return evidence to FabForge.' : 'Live queue viewer · refreshes every 15 seconds. Select a job to inspect its setup and toolpath.'}</p>
          </div>
          <Link to="/shop">Machine dashboard</Link>
        </header>
        <p className={styles.banner}>
          Offline simulation only. Importing and playback send no commands to the Shapeoko.
        </p>
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className={styles.banner}>
            {notice}
          </p>
        )}
        {!config && <p>Loading integration settings…</p>}
        {config && !config.configured && (
          <section className={styles.card}>
            <h2>Connect this shop to FabForge</h2>
            <p>
              Configure the FabForge server URL, workspace ID and a workspace API token on the CNCjs server. The token
              stays on the server.
            </p>
            <p>
              See <code>deployment/fabforge.md</code> for installation and token scopes.
            </p>
            <button type="button" disabled={busy} onClick={this.refresh}>
              Check connection
            </button>
          </section>
        )}
        {config && config.configured && (
          <div className={styles.layout}>
            <aside className={styles.card}>
              <div className={styles.toolbar}>
                <h2>Work orders</h2>
                <button type="button" disabled={busy} onClick={this.refresh}>
                  Refresh
                </button>
              </div>
              <label>
                Show{' '}
                <select value={filter} onChange={(e) => this.setState({ filter: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="all">All</option>
                </select>
              </label>
              <p className={styles.muted}>
                Workspace: {config.workspaceId}
                {config.resourceId && ` · Resource: ${config.resourceId}`}
              </p>
              {!visible.length && (
                <p>
                  No CNC or laser work orders in this view. Create a work order in FabForge and assign its job to this
                  machine resource.
                </p>
              )}
              {visible.map((order) => (
                <button
                  type="button"
                  key={order.id}
                  disabled={busy}
                  className={styles.order}
                  aria-pressed={!!detail && detail.workOrder.id === order.id}
                  onClick={() => this.open(order.id)}
                >
                  <strong>{order.title}</strong>
                  <span>
                    {order.status} · {(order.processTypes || []).join(', ')}
                  </span>
                </button>
              ))}
            </aside>
            <main className={styles.content}>
              {!detail && (
                <section className={styles.card}>
                  <h2>Select a work order</h2>
                  <p>
                    FabForge owns job ordering, readiness and production records. This view reads that queue and records
                    review decisions.
                  </p>
                </section>
              )}
              {detail && (
                <section className={styles.card}>
                  <h2>{detail.workOrder.title}</h2>
                  <p>{detail.workOrder.description}</p>
                  <p>
                    Status: <strong>{detail.workOrder.status}</strong>
                  </p>
                  <h3>Jobs</h3>
                  {!jobs.length && <p>No matching jobs assigned to this resource.</p>}
                  <div className={styles.jobs}>
                    {jobs.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        disabled={busy}
                        aria-pressed={!!job && job.id === item.id}
                        onClick={() => this.selectJob(item)}
                      >
                        {item.title}
                        <small>
                          {item.processType} · {item.status} · queue{' '}
                          {item.queuePosition === null ? 'unassigned' : item.queuePosition}
                        </small>
                      </button>
                    ))}
                  </div>
                  <ProductionPacket detail={detail} job={job} />
                </section>
              )}
              {job && (
                <section className={styles.card}>
                  <h2>{job.title}</h2>
                  <details>
                    <summary>Job source reference</summary>
                    <pre>{pretty(job.sourceRef)}</pre>
                  </details>
                  <fieldset disabled={busy}>
                    <legend>Import G-code from FabForge</legend>
                    {(job.reviewSources || []).length > 0 && (
                      <label>
                        Linked files
                        <select
                          value={this.state.candidate}
                          onChange={(e) => {
                            const candidate = e.target.value;
                            this.applySource(
                              candidate === '' ? {} : job.reviewSources[Number(candidate)].source,
                              candidate
                            );
                          }}
                        >
                          <option value="">Enter a reference manually</option>
                          {job.reviewSources.map((item, index) => (
                            <option key={JSON.stringify(item.source)} value={String(index)}>
                              {item.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    {!(job.reviewSources || []).length && (
                      <p>
                        No importable files are linked yet. Attach a G-code artifact or a commit-pinned repository
                        source in FabForge, or enter its reference below.
                      </p>
                    )}
                    <label>
                      Source{' '}
                      <select
                        value={this.state.sourceType}
                        onChange={(e) => this.setState({
                            sourceType: e.target.value,
                            candidate: '',
                            review: null,
                            acknowledged: false,
                            played: false
                          })}
                      >
                        <option value="artifact">Stored artifact</option>
                        <option value="repo">Repository at commit</option>
                      </select>
                    </label>
                    <div className={styles.fields}>
                      {(this.state.sourceType === 'artifact'
                        ? [['artifactId', 'Artifact ID']]
                        : [
                            ['owner', 'Repository owner'],
                            ['repo', 'Repository name'],
                            ['path', 'G-code path (.nc, .gcode, .tap)'],
                            ['ref', 'Full commit SHA']
                          ]
                      ).map(([key, label]) => (
                        <label key={key}>
                          {label}
                          <input
                            value={this.state[key]}
                            onChange={(e) => this.setState({
                                [key]: e.target.value,
                                candidate: '',
                                review: null,
                                acknowledged: false,
                                played: false
                              })}
                          />
                        </label>
                      ))}
                    </div>
                    <button type="button" onClick={this.importGcode}>
                      Import & backplot
                    </button>
                    <p className={styles.muted}>
                      The selected source is recorded with its SHA-256 hash. Review supports files up to 2 MiB / 20,000
                      lines.
                    </p>
                  </fieldset>
                </section>
              )}
              {review && (
                <section className={styles.card}>
                  <div className={styles.toolbar}>
                    <h2>{analysis.complete ? 'Toolpath simulation' : 'Partial backplot — review blocked'}</h2>
                    <button type="button" onClick={this.download}>
                      Download G-code
                    </button>
                  </div>
                  <div className={styles.metrics}>
                    <span>
                      <strong>{analysis.segments.length}</strong> segments
                    </span>
                    <span>
                      <strong>{(analysis.seconds / 60).toFixed(1)} min</strong> estimated motion
                    </span>
                    <span>
                      <strong>{analysis.distance.toFixed(1)} mm</strong> tool travel
                    </span>
                  </div>
                  <Toolpath key={review.hash} review={review} onViewed={() => this.setState({ played: true })} />
                  <p>
                    Work bounds (mm): {analysis.bounds.min.map((v) => v.toFixed(2)).join(', ')} →{' '}
                    {analysis.bounds.max.map((v) => v.toFixed(2)).join(', ')}
                  </p>
                  {analysis.errors.map((item) => (
                    <p key={item.line + item.message} role="alert" className={styles.error}>
                      Line {item.line}: {item.message}
                    </p>
                  ))}
                  {analysis.warnings.map((item) => (
                    <p key={item.line + item.message}>
                      Line {item.line}: {item.message}
                    </p>
                  ))}
                  <details>
                    <summary>G-code / SHA-256 {review.hash.slice(0, 16)}…</summary>
                    <code>{review.hash}</code>
                    <pre>{review.gcode}</pre>
                  </details>
                  <ul>
                    {analysis.limitations.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <fieldset disabled={busy || !canControl}>
                    <legend>Record review in FabForge</legend>
                    <label>
                      Decision{' '}
                      <select
                        value={this.state.decision}
                        onChange={(e) => this.setState({ decision: e.target.value, acknowledged: false })}
                      >
                        <option value="reviewed">Toolpath reviewed</option>
                        <option value="changes_requested">Changes required — block work order</option>
                      </select>
                    </label>
                    <label>
                      Review notes
                      <textarea
                        value={this.state.notes}
                        maxLength={4000}
                        onChange={(e) => this.setState({ notes: e.target.value })}
                      />
                    </label>
                    <label className={styles.check}>
                      <input
                        type="checkbox"
                        checked={this.state.acknowledged}
                        onChange={(e) => this.setState({ acknowledged: e.target.checked })}
                      />
                      I reviewed this exact file and understand the simulation limits. Requesting changes blocks the
                      work order.
                    </label>
                    <button
                      type="button"
                      disabled={
                        !this.state.acknowledged ||
                        this.state.notes.trim().length < 3 ||
                        (this.state.decision === 'reviewed' && (!analysis.complete || !this.state.played))
                      }
                      onClick={this.saveReview}
                    >
                      Save review
                    </button>
                    {this.state.decision === 'reviewed' && !this.state.played && (
                      <p>Play the simulation to the end before saving a completed review.</p>
                    )}
                  </fieldset>
                  {badgeAccess && canControl && (
                    <div>
                      <button type="button" onClick={this.release} disabled={busy || !access.machineAvailable || !analysis.complete || !this.state.played || !this.state.acknowledged}>
                        Release for setup
                      </button>
                      <p>Release records your identity and this exact file. It does not start the machine.</p>
                    </div>
                  )}
                </section>
              )}
              {job && canControl && (
                <section className={styles.card}>
                  <h2>Queue management</h2>
                  <p>
                    FabForge validates these state transitions. A retry/rework action requeues the job; cancellation
                    removes it from production.
                  </p>
                  <fieldset disabled={busy}>
                    <label>
                      Action{' '}
                      <select
                        value={this.state.disposition}
                        onChange={(e) => this.setState({ disposition: e.target.value })}
                      >
                        <option value="retry_required">Request retry</option>
                        <option value="rework_required">Request rework</option>
                        <option value="approved_cancellation">Cancel job</option>
                      </select>
                    </label>
                    <label>
                      Reason
                      <textarea
                        value={this.state.notes}
                        maxLength={4000}
                        onChange={(e) => this.setState({ notes: e.target.value })}
                      />
                    </label>
                    <button type="button" disabled={this.state.notes.trim().length < 3} onClick={this.manage}>
                      Apply queue action
                    </button>
                  </fieldset>
                </section>
              )}
            </main>
          </div>
        )}
        {busy && <p role="status">Working with FabForge…</p>}
      </div>
    );
  }
}

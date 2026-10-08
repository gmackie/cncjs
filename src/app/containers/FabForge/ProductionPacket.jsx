import React from 'react';
import PropTypes from 'prop-types';
import styles from './index.styl';

const label = (key) => key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
const display = (value) => {
  if (value === null || value === undefined || value === '') {
    return 'Not specified';
  }
  if (Array.isArray(value)) {
    return value.length ? value.map(display).join(', ') : 'Not specified';
  }
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
};

const ProductionPacket = ({ detail, job }) => {
  const relevant = (item) => !job || !item.jobId || item.jobId === job.id;
  const sheets = (detail.setupSheets || []).filter(relevant);
  const checklist = (detail.checklistItems || []).filter(relevant);
  const records = (detail.productionRecords || []).filter(relevant);
  const reviews = (detail.validations || []).filter(relevant);
  return (
    <div className={styles.packet}>
      <details open>
        <summary>Setup & readiness{job ? ` · ${job.title}` : ''}</summary>
        {!sheets.length && (
          <p>No setup sheet recorded. Stock, workholding, tools and origin still need verification.</p>
        )}
        {sheets.map((sheet, index) => {
          const payload = sheet.setupPayload || {};
          const fields = payload.fields || sheet.setupFields || {};
          return (
            <section key={sheet.id || `sheet-${index}`}>
              <h3>{sheet.title || sheet.label || 'Setup sheet'}</h3>
              <dl>
                {Object.keys(fields).map((key) => (
                  <div key={key}>
                    <dt>{label(key)}</dt>
                    <dd>{display(fields[key])}</dd>
                  </div>
                ))}
              </dl>
              {!Object.keys(fields).length && <p>No structured setup fields provided.</p>}
            </section>
          );
        })}
        <h3>Checklist</h3>
        {!checklist.length && <p>No checklist recorded.</p>}
        <ul>
          {checklist.map((item, index) => (
            <li key={item.id || `check-${index}`}>
              <strong>{item.label || item.title || 'Check'}</strong> — {label(item.status || 'unknown')}
              {item.evidenceRef && <span> · Evidence: {item.evidenceRef}</span>}
            </li>
          ))}
        </ul>
      </details>
      <details open={records.length > 0}>
        <summary>Production history ({records.length})</summary>
        {!records.length && <p>No physical output recorded in FabForge.</p>}
        {records.map(record => (
          <section key={record.id}>
            <h3>{display(record.quantity)} {record.unit || 'each'} · {label(record.outcome || 'unknown')}</h3>
            <p>{record.status === 'draft' ? 'Draft · awaiting acceptance in FabForge' : label(record.status || 'unknown')}</p>
            <p>{display(record.note)}</p>
            {record.metrics && record.metrics.cncjs && (
              <div>
                <p>Reported by operator {display(record.metrics.cncjs.operatorId)}</p>
                <p>G-code SHA-256: <code>{display(record.metrics.cncjs.sha256)}</code></p>
              </div>
            )}
            {record.createdAt && <p>{String(record.createdAt)}</p>}
          </section>
        ))}
      </details>
      <details>
        <summary>Previous reviews ({reviews.length})</summary>
        {!reviews.length && <p>No review evidence recorded.</p>}
        {reviews.map((review, index) => (
          <section key={review.id || `review-${index}`}>
            <h3>
              {review.label || review.validationType || 'Review'} · {review.status}
            </h3>
            {review.payload && (
              <div>
                <p>{display(review.payload.notes)}</p>
                {review.payload.sha256 && (
                  <p>
                    G-code SHA-256: <code>{review.payload.sha256}</code>
                  </p>
                )}
              </div>
            )}
            {review.createdAt && <p>{String(review.createdAt)}</p>}
          </section>
        ))}
      </details>
    </div>
  );
};
ProductionPacket.propTypes = { detail: PropTypes.object.isRequired, job: PropTypes.object };
export default ProductionPacket;

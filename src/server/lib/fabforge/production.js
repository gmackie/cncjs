import { configuration, FabForgeError, request, segment } from './client';

// Production reports are operator statements, never inferred from sender progress.
export const createProduction = ({ remote = request, config = configuration, access } = {}) => {
  let pending = false;
  const uncertain = new Set();
  return async (token, input = {}) => {
    if (pending) {
      throw new FabForgeError('A production report is already being saved.', 409);
    }
    pending = true;
    try {
      const session = await access.requireOperator(token);
      const release = session && session.release;
      if (!release || release.workOrderId !== input.workOrderId || release.jobId !== input.jobId) {
        throw new FabForgeError('Release this job for setup before reporting its output.', 409);
      }
      if (!['accepted', 'rework_required', 'scrapped'].includes(input.outcome) ||
          !Number.isSafeInteger(input.quantity) || input.quantity < 1 || input.quantity > 100000 ||
          typeof input.note !== 'string' || input.note.trim().length < 3 || input.note.length > 4000 ||
          input.confirmed !== true) {
        throw new FabForgeError('Confirm physical output, choose an outcome, quantity (1–100000), and notes (3–4000 characters).');
      }
      const { resourceId } = config();
      const path = `work-orders/${segment(release.workOrderId)}`;
      const detail = await remote(path);
      const job = (detail.jobs || []).find(item => item.id === release.jobId);
      if (!resourceId || !job || job.resourceId !== resourceId || !['cnc', 'laser_cut'].includes(job.processType)) {
        throw new FabForgeError('Released job is no longer assigned to this machine.', 409);
      }
      // v0 does not expose its internal idempotency key. Reconcile a timed-out POST
      // against persisted evidence before allowing another attempt for this release.
      const existing = (detail.productionRecords || []).find(item => {
        const report = item.metrics && item.metrics.cncjs;
        return item.jobId === job.id && item.resourceId === resourceId && report &&
          report.sessionId === session.id && report.releasedAt === release.releasedAt &&
          report.sha256 === release.sha256;
      });
      const reportKey = `${session.id}:${release.releasedAt}:${release.sha256}`;
      if (existing) {
        uncertain.delete(reportKey);
        return { productionRecord: existing, existing: true };
      }
      if (uncertain.has(reportKey)) {
        throw new FabForgeError('Previous save outcome is unknown. Check FabForge; automatic resubmission is blocked.', 409);
      }
      if (uncertain.size >= 1000) {
        throw new FabForgeError('Too many unresolved reports. Contact the shop administrator.', 503);
      }
      if (!detail.workOrder || !['ready', 'in_progress'].includes(detail.workOrder.status) ||
          !['queued', 'ready', 'in_progress'].includes(job.status)) {
        throw new FabForgeError('This job is no longer open for a production report.', 409);
      }
      const current = await access.requireOperator(token);
      if (current !== session || current.release !== release) {
        throw new FabForgeError('Operator session or released file changed. Review the job again.', 409);
      }
      access.record('production_report_requested', { jobId: job.id, workOrderId: release.workOrderId, sha256: release.sha256 });
      uncertain.add(reportKey);
      const result = await remote(`${path}/production-records`, {
        method: 'POST',
        body: {
          jobId: job.id,
          resourceId,
          processType: job.processType,
          status: 'draft',
          outcome: input.outcome,
          quantity: input.quantity,
          unit: 'each',
          note: input.note.trim(),
          sourceRef: release.source,
          metrics: {
            cncjs: {
              operatorId: session.operator.id,
              sessionId: session.id,
              releasedAt: release.releasedAt,
              sha256: release.sha256,
              evidenceType: 'operator_report',
              machineCompletionVerified: false
            }
          }
        }
      });
      uncertain.delete(reportKey);
      return result;
    } finally {
      pending = false;
    }
  };
};

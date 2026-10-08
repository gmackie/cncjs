import crypto from 'crypto';
import { configuration, FabForgeError, request, segment } from './client';
import simulate from './simulate-async';
import reviewSources from './review-sources';

export const sourcePath = (source) => {
  if (!source || typeof source !== 'object') {
    throw new FabForgeError('Select a G-code artifact or repository file.');
  }
  if (source.artifactId) {
    return { path: `artifacts/${segment(source.artifactId)}` };
  }
  const { owner, repo, path, ref } = source;
  if (typeof path !== 'string' || !/\.(nc|gcode|tap)$/i.test(path) || path.startsWith('/')) {
    throw new FabForgeError('Select a relative .nc, .gcode or .tap repository path.');
  }
  // Pin repository imports to a commit, not a moving branch.
  if (typeof ref !== 'string' || !/^[a-f0-9]{40}$/i.test(ref)) {
    throw new FabForgeError('Repository review requires the full 40-character commit SHA.');
  }
  return {
    path: `repos/${segment(owner)}/${segment(repo)}/raw/${path.split('/').map(segment).join('/')}`,
    query: { ref }
  };
};

export const createService = (remote = request, config = configuration) => {
  const detail = async (id) => {
    const result = await remote(`work-orders/${segment(id)}`);
    if (!result || !result.workOrder || !Array.isArray(result.jobs)) {
      throw new FabForgeError('Invalid work-order detail.', 502);
    }
    return { ...result, jobs: result.jobs.map(job => ({ ...job, reviewSources: reviewSources(result, job) })) };
  };
  const jobDetail = async (id, jobId) => {
    const result = await detail(id);
    const job = result.jobs.find((item) => item.id === jobId);
    if (!job || !['cnc', 'laser_cut'].includes(job.processType)) {
      throw new FabForgeError('CNC/laser job not found in this work order.', 404);
    }
    if (config().resourceId && job.resourceId !== config().resourceId) {
      throw new FabForgeError('Job is not assigned to this machine resource.', 409);
    }
    return { ...result, job };
  };
  const review = async (id, jobId, source) => {
    const { job, workOrder } = await jobDetail(id, jobId);
    const target = sourcePath(source);
    const gcode = await remote(target.path, { raw: true, query: target.query });
    const hash = crypto.createHash('sha256').update(gcode).digest('hex');
    const analysis = await simulate(gcode);
    return { job, workOrder, source, hash, gcode, analysis };
  };
  return {
    detail,
    async queue() {
      const result = await remote('work-orders');
      if (!result || !Array.isArray(result.workOrders)) {
        throw new FabForgeError('Invalid FabForge work queue.', 502);
      }
      return {
        workOrders: result.workOrders.filter((order) => (order.processTypes || []).some((type) => ['cnc', 'laser_cut'].includes(type)))
      };
    },
    review,
    async record(id, jobId, input) {
      if (
        !['reviewed', 'changes_requested'].includes(input.decision) ||
        typeof input.notes !== 'string' ||
        input.notes.trim().length < 3 ||
        input.notes.length > 4000
      ) {
        throw new FabForgeError('Choose a review decision and add notes (3–4000 characters).');
      }
      const result = await review(id, jobId, input.source);
      if (result.hash !== input.hash) {
        throw new FabForgeError('G-code changed since review. Import and simulate it again.', 409);
      }
      if (input.decision === 'reviewed' && !result.analysis.complete) {
        throw new FabForgeError('Unsupported or invalid G-code cannot be marked reviewed.', 409);
      }
      const { segments, ...summary } = result.analysis;
      return remote(`work-orders/${segment(id)}/validations`, {
        method: 'POST',
        body: {
          jobId,
          processType: result.job.processType,
          validationType: 'cncjs_toolpath_review',
          label: 'CNCjs offline toolpath review',
          // A successful backplot is not proof of safe machining or a passed physical gate.
          status: input.decision === 'changes_requested' ? 'failed' : 'warning',
          payload: {
            decision: input.decision,
            notes: input.notes.trim(),
            sha256: result.hash,
            source: input.source,
            simulator: summary,
            segmentCount: segments.length,
            physicalRun: false
          }
        }
      });
    },
    async disposition(id, jobId, input) {
      await jobDetail(id, jobId);
      if (
        !['approved_cancellation', 'retry_required', 'rework_required'].includes(input.disposition) ||
        typeof input.reason !== 'string' ||
        input.reason.trim().length < 3 ||
        input.reason.length > 4000
      ) {
        throw new FabForgeError('Choose a queue action and give a reason (3–4000 characters).');
      }
      return remote(`work-orders/${segment(id)}/jobs/${segment(jobId)}/disposition`, {
        method: 'POST',
        body: { disposition: input.disposition, reason: input.reason.trim() }
      });
    }
  };
};

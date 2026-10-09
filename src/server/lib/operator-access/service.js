import crypto from 'crypto';
import { appendUsage } from './usage';
import { configuration, FabForgeError, request } from '../fabforge/client';

const digest = (value) => crypto.createHash('sha256').update(value).digest('hex');
export const badgeDigest = (workspaceId, resourceId, badge) => digest(`${workspaceId}:${resourceId}:${badge.trim()}`);
const fail = (message, status = 403) => {
  throw new FabForgeError(message, status);
};
// One machine, one operator lease. Tokens exist only in memory; restart locks controls.
export const createAccess = ({
  remote = request,
  config = configuration,
  now = Date.now,
  audit = appendUsage,
  enabled = () => process.env.CNCJS_BADGE_ACCESS !== '0',
} = {}) => {
  let lease = null;
  let attempts = [];
  let pending = false;
  let lastCheck = 0;
  let resource = null;
  let checking = null;
  const record = (type, extra = {}) => audit({
      type,
      at: new Date(now()).toISOString(),
      resourceId: config().resourceId,
      operatorId: lease && lease.operator.id,
      sessionId: lease && lease.id,
      ...extra,
    });
  const end = (reason, endedAt = now()) => {
    const old = lease;
    lease = null; // Lock even if audit storage fails.
    if (old) {
      audit({
        type: 'session_ended',
        at: new Date(endedAt).toISOString(),
        observedAt: new Date(now()).toISOString(),
        resourceId: config().resourceId,
        operatorId: old.operator.id,
        sessionId: old.id,
        reason,
        durationMs: endedAt - old.startedAt,
      });
    }
  };
  const expire = () => {
    if (
      lease &&
      (now() >= lease.expiresAt || now() - lease.lastUsed >= 15 * 60 * 1000)
    ) {
      end('expired', Math.min(lease.expiresAt, lease.lastUsed + 15 * 60 * 1000));
    }
  };
  const readResource = async () => {
    const { resourceId, workspaceId } = config();
    if (!resourceId || !workspaceId) {
      fail('Configure the FabForge workspace and machine resource.', 503);
    }
    const result = await remote('resources');
    const found = (result.resources || []).find(
      (item) => item.id === resourceId
    );
    if (!found) {
      fail('Machine resource is unavailable in FabForge.', 503);
    }
    return found;
  };
  const grantFor = (item, hash) => {
    const policy = item.policy && item.policy.cncjsAccess;
    if (!policy || policy.version !== 1 || !Array.isArray(policy.grants)) {
      return null;
    }
    return policy.grants.find(
      (grant) => grant.enabled === true &&
        grant.badgeHash === hash &&
        typeof grant.operatorId === 'string' &&
        grant.operatorId &&
        Number.isFinite(Date.parse(grant.expiresAt)) &&
        Date.parse(grant.expiresAt) > now()
    );
  };
  const check = async () => {
    expire();
    if (!lease || now() - lastCheck < 15000) {
      return;
    }
    if (!checking) {
      const current = lease;
      checking = (async () => {
        try {
          const found = await readResource();
          if (lease !== current) {
            return;
          }
          const grant = grantFor(found, current.badgeHash);
          if (!grant || grant.operatorId !== current.operator.id) {
            end('authorization_revoked');
            return;
          }
          resource = found;
          current.grantExpiresAt = Date.parse(grant.expiresAt);
          lastCheck = now();
        } catch (err) {
          if (lease === current) {
            end('authorization_unavailable');
          }
          throw err;
        } finally {
          checking = null;
        }
      })();
    }
    await checking;
  };
  const owner = (token) => {
    expire();
    if (lease && now() >= lease.grantExpiresAt) {
      end('authorization_expired', lease.grantExpiresAt);
    }
    return !!(
      lease &&
      typeof token === 'string' &&
      token &&
      digest(token) === lease.tokenHash
    );
  };
  const status = (token) => {
    const mine = owner(token);
    return {
      enabled: enabled(),
      authorized: mine,
      operator: lease && lease.operator,
      expiresAt: mine
        ? Math.min(
            lease.expiresAt,
            lease.lastUsed + 15 * 60 * 1000,
            lease.grantExpiresAt
          )
        : null,
      release: mine ? lease.release : null,
      machineAvailable: mine && resource.status === 'available',
    };
  };
  const requireOperator = async (
    token,
    { motion = false, touch = true } = {}
  ) => {
    if (!enabled()) {
      return null;
    }
    await check();
    if (!owner(token)) {
      fail('Viewer mode. Badge in with machine authorization to continue.');
    }
    if (motion && resource.status !== 'available') {
      fail(
        'Machine is restricted in FabForge. Complete commissioning before operating.',
        409
      );
    }
    if (touch) {
      lease.lastUsed = now();
    }
    return lease;
  };
  return {
    enabled,
    status,
    check,
    requireOperator,
    monitoring() {
      expire();
      return {
        operatorId: lease ? lease.operator.id : null,
        release: lease && lease.release ? {
          workOrderId: lease.release.workOrderId,
          jobId: lease.release.jobId,
          sha256: lease.release.sha256,
          releasedAt: lease.release.releasedAt,
        } : null,
      };
    },
    async badgeIn(badge) {
      if (!enabled()) {
        fail('Badge access is not enabled.', 409);
      }
      attempts = attempts.filter((at) => now() - at < 60000);
      if (attempts.length >= 10) {
        fail('Too many badge attempts. Wait one minute.', 429);
      }
      attempts.push(now());
      if (
        typeof badge !== 'string' ||
        !/^[\x21-\x7e]{4,128}$/.test(badge.trim())
      ) {
        fail('Badge not recognized.');
      }
      expire();
      if (pending || lease) {
        fail(
          'This machine already has an operator session. Badge out first.',
          409
        );
      }
      pending = true;
      try {
        const found = await readResource();
        const { workspaceId, resourceId } = config();
        const hash = badgeDigest(workspaceId, resourceId, badge);
        const grant = grantFor(found, hash);
        if (!grant) {
          record('badge_denied');
          fail('Badge has no current authorization for this machine.');
        }
        const token = crypto.randomBytes(32).toString('hex');
        const candidate = {
          id: crypto.randomBytes(16).toString('hex'),
          tokenHash: digest(token),
          badgeHash: hash,
          operator: {
            id: grant.operatorId,
            name: grant.operatorName || grant.operatorId,
          },
          startedAt: now(),
          lastUsed: now(),
          expiresAt: now() + 8 * 60 * 60 * 1000,
          grantExpiresAt: Date.parse(grant.expiresAt),
          release: null,
        };
        record('session_started', {
          operatorId: candidate.operator.id,
          sessionId: candidate.id,
        });
        lease = candidate;
        resource = found;
        lastCheck = now();
        return { ...status(token), token };
      } finally {
        pending = false;
      }
    },
    async badgeOut(token) {
      await requireOperator(token, { touch: false });
      end('badge_out');
      return status('');
    },
    async release(token, review) {
      const current = await requireOperator(token, { motion: true });
      if (!current) {
        fail('Enable badge access before releasing jobs.', 409);
      }
      if (
        review.job.status !== 'queued' ||
        review.workOrder.status !== 'ready' ||
        !review.analysis.complete
      ) {
        fail(
          'Release requires a ready work order, queued job and supported G-code.',
          409
        );
      }
      const released = {
        workOrderId: review.workOrder.id,
        jobId: review.job.id,
        sha256: review.hash,
        source: review.source,
        releasedAt: new Date(now()).toISOString(),
      };
      // Remote evidence is written before granting the local release. Never start a runner or machine.
      await remote(
        `work-orders/${encodeURIComponent(review.workOrder.id)}/validations`,
        {
          method: 'POST',
          body: {
            jobId: review.job.id,
            processType: review.job.processType,
            validationType: 'cncjs_setup_release',
            label: 'Released to operator for setup',
            status: 'warning',
            payload: {
              ...released,
              operatorId: current.operator.id,
              sessionId: current.id,
              physicalRun: false,
            },
          },
        }
      );
      await requireOperator(token, { motion: true });
      if (lease !== current) {
        fail('Operator session changed. Release the job again.', 409);
      }
      record('job_released', released);
      current.release = released;
      return status(token);
    },
    record,
  };
};
export default createAccess();

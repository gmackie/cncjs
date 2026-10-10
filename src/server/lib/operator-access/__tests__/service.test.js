/* eslint-env jest */
import { createAccess, badgeDigest } from '../service';

const setup = () => {
  let time = Date.parse('2026-10-08T12:00:00Z');
  const resource = {
    id: 'machine',
    status: 'available',
    policy: {
      cncjsAccess: {
        version: 1,
        grants: [
          {
            operatorId: 'graham',
            operatorName: 'Graham',
            enabled: true,
            expiresAt: '2027-01-01T00:00:00Z',
            badgeHash: badgeDigest('workspace', 'machine', '12345678'),
          },
        ],
      },
    },
  };
  const audit = jest.fn();
  const remote = jest.fn(() => Promise.resolve({ resources: [resource] }));
  const access = createAccess({
    remote,
    audit,
    config: () => ({ workspaceId: 'workspace', resourceId: 'machine' }),
    enabled: () => true,
    now: () => time,
  });
  return {
    access,
    audit,
    remote,
    resource,
    advance: (ms) => {
      time += ms;
    },
  };
};
const review = {
  workOrder: { id: 'order', status: 'ready' },
  job: { id: 'job', status: 'queued', processType: 'cnc' },
  hash: 'hash',
  source: { artifactId: 'code' },
  analysis: { complete: true },
};

test('viewers and unrelated browser tokens cannot control the machine', async () => {
  const { access } = setup();
  expect(access.status('').authorized).toBe(false);
  await expect(access.requireOperator('')).rejects.toThrow('Viewer mode');
  const session = await access.badgeIn('12345678');
  expect(access.status(session.token).authorized).toBe(true);
  expect(access.status('another-browser').authorized).toBe(false);
  await expect(access.requireOperator('another-browser')).rejects.toThrow(
    'Viewer mode'
  );
});
test('requires enabled, unexpired machine-specific grants', async () => {
  const { access, resource } = setup();
  await expect(access.badgeIn('unregistered')).rejects.toThrow(
    'no current authorization'
  );
  resource.policy.cncjsAccess.grants[0].badgeHash = badgeDigest(
    'workspace',
    'other-machine',
    '12345678'
  );
  await expect(access.badgeIn('12345678')).rejects.toThrow(
    'no current authorization'
  );
  resource.policy.cncjsAccess.grants[0].badgeHash = badgeDigest(
    'workspace',
    'machine',
    '12345678'
  );
  resource.policy.cncjsAccess.grants[0].enabled = false;
  await expect(access.badgeIn('12345678')).rejects.toThrow(
    'no current authorization'
  );
  resource.policy.cncjsAccess.grants[0].enabled = true;
  resource.policy.cncjsAccess.grants[0].expiresAt = '2020-01-01';
  await expect(access.badgeIn('12345678')).rejects.toThrow(
    'no current authorization'
  );
});
test('does not allow a second operator or concurrent badge-in', async () => {
  const { access } = setup();
  const first = access.badgeIn('12345678');
  await expect(access.badgeIn('12345678')).rejects.toThrow(
    'already has an operator'
  );
  await first;
  await expect(access.badgeIn('12345678')).rejects.toThrow(
    'already has an operator'
  );
});
test('viewing does not extend idle lease; badge-out revokes old token', async () => {
  const { access, advance } = setup();
  const first = await access.badgeIn('12345678');
  advance(14 * 60000);
  expect(access.status(first.token).authorized).toBe(true);
  advance(60000);
  expect(access.status(first.token).authorized).toBe(false);
  const second = await access.badgeIn('12345678');
  await access.badgeOut(second.token);
  await expect(access.requireOperator(second.token)).rejects.toThrow(
    'Viewer mode'
  );
});
test('revoked grants and authorization outages fail closed', async () => {
  const { access, advance, resource, remote } = setup();
  const first = await access.badgeIn('12345678');
  resource.policy.cncjsAccess.grants = [];
  advance(15001);
  await expect(access.requireOperator(first.token)).rejects.toThrow(
    'Viewer mode'
  );
  expect(access.status(first.token).authorized).toBe(false);
  remote.mockRejectedValue(new Error('offline'));
  await expect(access.badgeIn('12345678')).rejects.toThrow('offline');
});
test('active session is revoked on FabForge outage', async () => {
  const { access, advance, remote } = setup();
  const session = await access.badgeIn('12345678');
  advance(15001);
  remote.mockRejectedValue(new Error('offline'));
  await expect(access.requireOperator(session.token)).rejects.toThrow(
    'offline'
  );
  expect(access.status(session.token).authorized).toBe(false);
});
test('restricted resource cannot release work or issue motion', async () => {
  const { access, resource } = setup();
  resource.status = 'restricted';
  const session = await access.badgeIn('12345678');
  await expect(
    access.requireOperator(session.token, { motion: true })
  ).rejects.toThrow('restricted');
  await expect(access.release(session.token, review)).rejects.toThrow(
    'restricted'
  );
});
test('release records operator and exact file without marking job started', async () => {
  const { access, remote, audit } = setup();
  const session = await access.badgeIn('12345678');
  const result = await access.release(session.token, review);
  expect(result.release.sha256).toBe('hash');
  expect(remote).toHaveBeenLastCalledWith(
    'work-orders/order/validations',
    expect.objectContaining({
      body: expect.objectContaining({
        status: 'warning',
        payload: expect.objectContaining({
          operatorId: 'graham',
          physicalRun: false,
        }),
      }),
    })
  );
  expect(audit).toHaveBeenLastCalledWith(
    expect.objectContaining({ type: 'job_released', jobId: 'job' })
  );
  expect(JSON.stringify(audit.mock.calls)).not.toContain('12345678');
  expect(JSON.stringify(audit.mock.calls)).not.toContain(session.token);
});
test('cannot release stale, blocked or unsupported jobs, or failed remote evidence', async () => {
  const { access, remote } = setup();
  const session = await access.badgeIn('12345678');
  await expect(
    access.release(session.token, {
      ...review,
      job: { ...review.job, status: 'cancelled' },
    })
  ).rejects.toThrow('ready work order');
  await expect(
    access.release(session.token, { ...review, analysis: { complete: false } })
  ).rejects.toThrow('supported');
  remote.mockRejectedValue(new Error('offline'));
  await expect(access.release(session.token, review)).rejects.toThrow(
    'offline'
  );
  expect(access.status(session.token).release).toBeNull();
});
test('audit failure never grants control, and badge attempts are bounded', async () => {
  const { access, audit } = setup();
  audit.mockImplementation(() => {
    throw new Error('disk full');
  });
  await expect(access.badgeIn('12345678')).rejects.toThrow('disk full');
  expect(access.status('').operator).toBeNull();
  audit.mockReset();
  for (let i = 0; i < 9; i++) {
    // Sequential attempts exercise the shared rate limit.
    // eslint-disable-next-line no-await-in-loop
    await expect(access.badgeIn('invalid')).rejects.toThrow();
  }
  await expect(access.badgeIn('12345678')).rejects.toMatchObject({
    status: 429,
  });
});

test('delayed expiry inspection does not overcount operator access time', async () => {
  const { access, advance, audit } = setup();
  const session = await access.badgeIn('12345678');
  advance(24 * 60 * 60000);
  expect(access.status(session.token).authorized).toBe(false);
  expect(audit).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'session_ended', durationMs: 15 * 60000 }));
});

test('temporary commissioning badge never grants production access, even on available resource', async () => {
  const { access, resource, advance } = setup();
  Object.assign(resource.policy.cncjsAccess.grants[0], { commissioning: true, commissioningOnly: true });
  const session = await access.badgeIn('12345678');
  expect(session.machineAvailable).toBe(false);
  await expect(access.requireCommissioning(session.token)).rejects.toThrow('Start');
  await access.startCommissioning(session.token, true);
  await expect(access.requireCommissioning(session.token)).resolves.toBeTruthy();
  await expect(access.requireOperator(session.token, { motion: true })).rejects.toThrow('production');
  await expect(access.release(session.token, review)).rejects.toThrow('production');
  advance(10 * 60 * 1000);
  await access.requireCommissioning(session.token);
  advance(10 * 60 * 1000);
  await access.requireCommissioning(session.token);
  advance(10 * 60 * 1000);
  await expect(access.requireCommissioning(session.token)).rejects.toThrow('Start');
  await access.badgeOut(session.token);
});
test('ordinary operator grant cannot commission a restricted machine; capability revocation locks setup', async () => {
  const { access, resource, advance } = setup();
  const grant = resource.policy.cncjsAccess.grants[0];
  resource.status = 'restricted';
  const session = await access.badgeIn('12345678');
  await expect(access.startCommissioning(session.token, true)).rejects.toThrow('authorization');
  grant.commissioning = true;
  advance(16000);
  await access.startCommissioning(session.token, true);
  grant.commissioning = false;
  advance(16000);
  await expect(access.requireCommissioning(session.token)).rejects.toThrow('Start');
});

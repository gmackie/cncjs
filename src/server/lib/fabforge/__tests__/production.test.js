/* eslint-env jest */
import { createProduction } from '../production';

const setup = () => {
  const session = { id: 's1',
operator: { id: 'o1' },
release: {
    workOrderId: 'w1', jobId: 'j1', sha256: 'hash', source: { artifactId: 'a1' }, releasedAt: '2026-10-08T12:00:00Z'
  } };
  const detail = { workOrder: { status: 'ready' }, jobs: [{ id: 'j1', resourceId: 'r1', processType: 'cnc', status: 'queued' }], productionRecords: [] };
  const access = { requireOperator: jest.fn().mockResolvedValue(session), record: jest.fn() };
  const remote = jest.fn((path, options) => {
    if (!options) {
      return detail;
    }
    const productionRecord = { id: 'p1', ...options.body };
    detail.productionRecords.push(productionRecord);
    return { productionRecord };
  });
  const report = createProduction({ access, remote, config: () => ({ resourceId: 'r1' }) });
  const input = { workOrderId: 'w1', jobId: 'j1', outcome: 'accepted', quantity: 2, note: 'Measured parts', confirmed: true };
  return { session, detail, access, remote, report, input };
};
test('records only draft operator evidence using server-owned identity and released source', async () => {
  const { report, remote, input } = setup();
  await report('token', { ...input, status: 'accepted', operatorId: 'forged', sha256: 'forged' });
  expect(remote).toHaveBeenLastCalledWith('work-orders/w1/production-records', {
    method: 'POST',
body: expect.objectContaining({ status: 'draft',
quantity: 2,
sourceRef: { artifactId: 'a1' },
      metrics: { cncjs: expect.objectContaining({ operatorId: 'o1', sha256: 'hash', machineCompletionVerified: false }) } })
  });
});
test.each([
  { quantity: 0 }, { quantity: 1.5 }, { quantity: 100001 }, { quantity: '2' },
  { outcome: 'complete' }, { confirmed: false }, { note: '  ' }, { note: 'a'.repeat(4001) }, { jobId: 'other' }
])('rejects invalid reports without writes: %j', async change => {
  const { report, remote, input } = setup();
  await expect(report('token', { ...input, ...change })).rejects.toThrow();
  expect(remote.mock.calls.some(([, options]) => options)).toBe(false);
});
test('viewer and maintenance bypass cannot fabricate operator output', async () => {
  const { report, access, input } = setup();
  access.requireOperator.mockRejectedValueOnce(new Error('Badge required'));
  await expect(report('', input)).rejects.toThrow('Badge');
  access.requireOperator.mockResolvedValue(null);
  await expect(report('', input)).rejects.toThrow('Release');
});
test('reconciles persisted report on retry, even if work order has since completed', async () => {
  const { report, remote, input, detail } = setup();
  await report('token', input);
  detail.workOrder.status = 'complete';
  const retry = await report('token', input);
  expect(retry.existing).toBe(true);
  expect(remote.mock.calls.filter(([, options]) => options)).toHaveLength(1);
});
test.each(['assignment', 'status', 'lease', 'release', 'audit'])('rejects changed %s before writing', async change => {
  const { report, input, detail, access, session, remote } = setup();
  if (change === 'assignment') {
 detail.jobs[0].resourceId = 'other';
}
  if (change === 'status') {
 detail.jobs[0].status = 'cancelled';
}
  if (change === 'lease') {
 access.requireOperator.mockResolvedValueOnce(session).mockResolvedValueOnce({ ...session });
}
  if (change === 'release') {
    access.requireOperator.mockImplementationOnce(() => session).mockImplementationOnce(() => {
      session.release = { ...session.release }; return session;
    });
  }
  if (change === 'audit') {
 access.record.mockImplementation(() => {
 throw new Error('Disk full');
});
}
  await expect(report('token', input)).rejects.toThrow();
  expect(remote.mock.calls.some(([, options]) => options)).toBe(false);
});
test('serializes concurrent reports and releases lock after failures', async () => {
  const { report, input, access, session } = setup();
  let resolve;
  access.requireOperator.mockImplementationOnce(() => new Promise(r => {
 resolve = r;
}));
  const first = report('token', input);
  await expect(report('token', input)).rejects.toThrow('already');
  resolve(session);
  await first;
  await expect(report('token', input)).resolves.toHaveProperty('existing', true);
});
test('ambiguous upstream failure cannot trigger another POST before evidence appears', async () => {
  const { report, remote, input, detail } = setup();
  remote.mockImplementation((path, options) => {
    if (options) {
 throw new Error('Connection lost');
}
    return detail;
  });
  await expect(report('token', input)).rejects.toThrow('Connection lost');
  await expect(report('token', input)).rejects.toThrow('outcome is unknown');
  expect(remote.mock.calls.filter(([, options]) => options)).toHaveLength(1);
});

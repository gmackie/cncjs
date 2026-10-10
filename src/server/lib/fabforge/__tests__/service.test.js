/* eslint-env jest */
import crypto from 'crypto';
import { createService, sourcePath } from '../service';

const gcode = 'G21 G90\nG0 Z5\nG1 X10 F100\nM5';
const hash = crypto.createHash('sha256').update(gcode).digest('hex');
const source = { artifactId: 'a1' };
const job = { id: 'j1', processType: 'cnc', resourceId: 'shapeoko' };
const detail = { workOrder: { id: 'w1', title: 'Fixture' }, jobs: [job] };
const setup = () => {
  const remote = jest.fn((path, options) => {
    if (path === 'work-orders') {
      return {
        workOrders: [
          { id: 'w1', processTypes: ['cnc'] },
          { id: 'w2', processTypes: ['three_d_print'] }
        ]
      };
    }
    if (path === 'work-orders/w1') {
      return detail;
    }
    if (path === 'artifacts/a1') {
      return gcode;
    }
    if (options && options.method === 'POST') {
      return { validation: { id: 'v1' } };
    }
    throw new Error('Unexpected request: ' + path);
  });
  return { remote, service: createService(remote, () => ({ resourceId: 'shapeoko' })) };
};
test('uses FabForge list/detail/raw contracts and leaves unrelated jobs out', async () => {
  const { service, remote } = setup();
  expect((await service.queue()).workOrders).toHaveLength(1);
  const result = await service.review('w1', 'j1', source);
  expect(result.hash).toBe(hash);
  expect(result.analysis.complete).toBe(true);
  expect(remote).toHaveBeenCalledWith('artifacts/a1', { raw: true, query: { workOrderId: 'w1', jobId: 'j1' } });
  expect(remote.mock.calls.every(([, options]) => !options || !options.method)).toBe(true);
});
test('records hash-bound offline evidence without passing a physical gate', async () => {
  const { service, remote } = setup();
  await service.record('w1', 'j1', { source, hash, decision: 'reviewed', notes: 'Checked paths and origin.' });
  expect(remote).toHaveBeenLastCalledWith(
    'work-orders/w1/validations',
    expect.objectContaining({
      method: 'POST',
      body: expect.objectContaining({
        status: 'warning',
        jobId: 'j1',
        payload: expect.objectContaining({ sha256: hash, physicalRun: false })
      })
    })
  );
});
test('refuses changed bytes, wrong job, wrong resource and unsupported successful reviews', async () => {
  const { service, remote } = setup();
  await expect(
    service.record('w1', 'j1', { source, hash: 'stale', decision: 'reviewed', notes: 'Checked' })
  ).rejects.toThrow('changed');
  await expect(service.review('w1', 'other', source)).rejects.toThrow('not found');
  await expect(createService(remote, () => ({ resourceId: 'different' })).review('w1', 'j1', source)).rejects.toThrow(
    'not assigned'
  );
  const bad = 'G53 G0 X1';
  const unsupported = createService(
    (path) => (path === 'artifacts/a1' ? bad : detail),
    () => ({})
  );
  await expect(
    unsupported.record('w1', 'j1', {
      source,
      hash: crypto.createHash('sha256').update(bad).digest('hex'),
      decision: 'reviewed',
      notes: 'Checked'
    })
  ).rejects.toThrow('Unsupported');
  expect(remote.mock.calls.every(([, options]) => !options || options.method !== 'POST')).toBe(true);
});
test('records requested changes as a failed validation and validates disposition', async () => {
  const { service, remote } = setup();
  await service.record('w1', 'j1', { source, hash, decision: 'changes_requested', notes: 'Origin is wrong' });
  expect(remote.mock.calls[remote.mock.calls.length - 1][1].body.status).toBe('failed');
  await service.disposition('w1', 'j1', { disposition: 'retry_required', reason: 'Updated stock' });
  expect(remote).toHaveBeenLastCalledWith('work-orders/w1/jobs/j1/disposition', {
    method: 'POST',
    body: { disposition: 'retry_required', reason: 'Updated stock' }
  });
  await expect(service.disposition('w1', 'j1', { disposition: 'start_job', reason: 'Run now' })).rejects.toThrow(
    'Choose'
  );
});
test('pins repository paths and refuses URL/traversal inputs', () => {
  const ref = 'a'.repeat(40);
  expect(sourcePath({ owner: 'shop', repo: 'parts', path: 'cam/part.nc', ref })).toEqual({
    path: 'repos/shop/parts/raw/cam/part.nc',
    query: { ref }
  });
  expect(() => sourcePath({ owner: 'shop', repo: 'parts', path: '../part.nc', ref })).toThrow();
  expect(() => sourcePath({ owner: 'shop', repo: 'parts', path: 'part.nc', ref: 'main' })).toThrow();
  expect(() => sourcePath({ artifactId: 'http://elsewhere' })).toThrow();
  expect(() => sourcePath({ url: 'http://elsewhere' })).toThrow();
});

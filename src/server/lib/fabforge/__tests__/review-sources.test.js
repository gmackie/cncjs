/* eslint-env jest */
import reviewSources from '../review-sources';

const repo = { owner: 'shop', repo: 'parts', path: 'cam/pocket.nc', ref: 'a'.repeat(40) };
test('discovers and deduplicates explicit job, setup, review and work-order references', () => {
  const job = { id: 'j1', sourceRef: { files: [{ artifactId: 'a1', name: 'pocket.nc' }, repo] } };
  const detail = {
    workOrder: { sourceFileRefs: [{ artifactId: 'a4' }] },
    setupSheets: [{ jobId: 'j1', artifactRefs: [{ artifactId: 'a1' }, { artifactId: 'a2' }] }],
    validations: [{ jobId: 'j1', payload: { source: { artifactId: 'a3' } } }]
  };
  const results = reviewSources(detail, job);
  expect(results.map((r) => r.source)).toEqual([
    { artifactId: 'a1' },
    repo,
    { artifactId: 'a2' },
    { artifactId: 'a3' },
    { artifactId: 'a4' }
  ]);
  expect(results[0].label).toBe('Job: pocket.nc');
});
test('excludes other jobs, unpinned refs and unrelated metadata', () => {
  const job = {
    id: 'j1',
    sourceRef: {
      files: [
        { ...repo, ref: 'main' },
        { ...repo, path: 'model.stl' }
      ],
      random: { artifactId: 'hidden' }
    }
  };
  expect(
    reviewSources(
      {
        setupSheets: [{ jobId: 'other', artifactRefs: [{ artifactId: 'private' }] }],
        validations: [{ payload: { source: { artifactId: 'other' } } }]
      },
      job
    )
  ).toEqual([]);
});
test('handles missing and bounded nested references without hanging', () => {
  expect(reviewSources({}, {})).toEqual([]);
  const source = {};
  source.source = source;
  expect(reviewSources({}, { sourceRef: source })).toEqual([]);
  const files = Array.from({ length: 1000 }, (_, i) => ({ artifactId: String(i) }));
  expect(reviewSources({}, { sourceRef: files })).toHaveLength(100);
});

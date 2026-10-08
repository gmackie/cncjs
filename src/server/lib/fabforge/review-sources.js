// Only discover explicit references in this job's production packet. No URL fetches.
export default function reviewSources(detail, job) {
  const found = [];
  const seen = new Set();
  let visited = 0;
  const visit = (value, origin, depth = 0) => {
    if (!value || typeof value !== 'object' || depth > 6 || visited++ > 1000 || found.length >= 100) {
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, origin, depth + 1));
      return;
    }
    let source;
    if (typeof value.artifactId === 'string' && value.artifactId.trim()) {
      source = { artifactId: value.artifactId };
    } else if (
      ['owner', 'repo', 'path', 'ref'].every((key) => typeof value[key] === 'string') &&
      /\.(nc|gcode|tap)$/i.test(value.path) &&
      /^[a-f0-9]{40}$/i.test(value.ref)
    ) {
      source = { owner: value.owner, repo: value.repo, path: value.path, ref: value.ref };
    }
    if (source) {
      const identity = JSON.stringify(source);
      if (!seen.has(identity)) {
        seen.add(identity);
        const name = typeof value.name === 'string' ? value.name : value.path;
        const fallback = source.artifactId ? `Artifact ${source.artifactId}` : source.path;
        const label = typeof name === 'string' && name ? name : fallback;
        found.push({ source, label: `${origin}: ${label}` });
      }
    }
    // Explicit reference containers only. Do not interpret free-form metadata as a source.
    ['source', 'sourceRef', 'artifactRefs', 'sources', 'files', 'toolpath', 'camPackage'].forEach((key) => visit(value[key], origin, depth + 1));
  };
  visit(job.sourceRef, 'Job');
  (detail.setupSheets || [])
    .filter((sheet) => !sheet.jobId || sheet.jobId === job.id)
    .forEach((sheet) => {
      visit(sheet.artifactRefs, 'Setup sheet');
      visit(sheet.setupPayload, 'Setup sheet');
    });
  (detail.validations || [])
    .filter((validation) => validation.jobId === job.id)
    .forEach((validation) => {
      visit(validation.payload && validation.payload.source, 'Previous review');
    });
  visit(detail.workOrder && detail.workOrder.sourceFileRefs, 'Work order');
  return found;
}

import { configuration } from '../lib/fabforge/client';
import { createService } from '../lib/fabforge/service';

const service = createService();
const handle = (action) => async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    res.send(await action(req));
  } catch (err) {
    res.status(err.status || 400).send({ msg: err.message || 'FabForge request failed.' });
  }
};

export const status = handle(() => {
  const { url, workspaceId, token, resourceId } = configuration();
  return { configured: !!(url && workspaceId && token), workspaceId, resourceId };
});
export const queue = handle(() => service.queue());
export const detail = handle((req) => service.detail(req.params.id));
export const review = handle((req) => service.review(req.params.id, req.params.jobId, req.body.source));
export const record = handle((req) => service.record(req.params.id, req.params.jobId, req.body));
export const disposition = handle((req) => service.disposition(req.params.id, req.params.jobId, req.body));

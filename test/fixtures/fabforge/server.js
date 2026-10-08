// Local FabForge contract fixture. No machine connection and no production writes.
// FABFORGE_URL=http://127.0.0.1:8010 FABFORGE_WORKSPACE_ID=fixture FABFORGE_TOKEN=fixture-only
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const workOrder = { id: 'fixture-order', title: 'Fixture · rounded pocket review', status: 'ready', processTypes: ['cnc'], description: 'Local API fixture — no production work order.' };
const job = { id: 'fixture-job', resourceId: 'fixture-machine', title: 'DWP611 pocket toolpath', processType: 'cnc', status: 'queued', queuePosition: 1, sourceRef: { files: [{ artifactId: 'fixture-code', name: 'rounded-pocket.nc' }] } };
const validations = [];
http.createServer((req, res) => {
  if (req.headers.authorization !== 'Bearer fixture-only') { res.writeHead(401); res.end(); return; }
  const url = new URL(req.url, 'http://localhost');
  const route = url.pathname.replace('/api/fabrication/v0/', '');
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');
    if (route === 'resources' && req.method === 'GET') {
      res.end(JSON.stringify({ data: { resources: [{ id: 'fixture-machine', status: 'available', policy: { cncjsAccess: { version: 1, grants: [{ enabled: true, operatorId: 'fixture-operator', operatorName: 'Demo operator', expiresAt: '2099-01-01T00:00:00Z', badgeHash: crypto.createHash('sha256').update('fixture:fixture-machine:DEMO1234').digest('hex') }] } } }] } })); return;
    }
    if (route === 'work-orders' && req.method === 'GET') { res.end(JSON.stringify({ data: { workOrders: [workOrder] } })); return; }
    if (route === 'work-orders/fixture-order' && req.method === 'GET') {
      res.end(JSON.stringify({ data: { workOrder, jobs: [job], setupSheets: [{ id: 'fixture-setup', jobId: 'fixture-job', title: 'Fixture setup', setupPayload: { fields: { stock_dimensions: 'Review only', tool_list: ['1/8 inch end mill'], origin: 'Stock top, front-left', workholding: null } } }], checklistItems: [{ label: 'Physical setup not commissioned', status: 'open' }], validations } })); return;
    }
    if (route === 'artifacts/fixture-code' && req.method === 'GET') {
      res.setHeader('Content-Type', 'text/plain'); res.end(fs.readFileSync(path.join(__dirname, 'fixture.nc'))); return;
    }
    if (route === 'work-orders/fixture-order/validations' && req.method === 'POST') {
      const validation = { id: `v${validations.length + 1}`, ...JSON.parse(Buffer.concat(chunks).toString()) };
      validations.push(validation);
      if (validation.status === 'failed') { workOrder.status = 'blocked'; }
      res.end(JSON.stringify({ data: { validation } })); return;
    }
    if (route.endsWith('/disposition') && req.method === 'POST') {
      const body = JSON.parse(Buffer.concat(chunks).toString());
      job.status = body.disposition === 'approved_cancellation' ? 'cancelled' : 'queued';
      res.end(JSON.stringify({ data: { job } })); return;
    }
    res.writeHead(404); res.end(JSON.stringify({ error: 'Fixture route not found' }));
  });
}).listen(8010, '127.0.0.1', () => console.log('FabForge local contract fixture listening on 127.0.0.1:8010'));

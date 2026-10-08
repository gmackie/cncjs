/* eslint-env jest */
import http from 'http';
import httpProxy from 'http-proxy';
import proxyError from '../lib/proxy-error';

test('a disconnected camera returns 503 and leaves the HTTP server responsive', async () => {
    // Allocate then close a local port to represent an absent camera service.
    const absent = http.createServer();
    await new Promise(resolve => {
 absent.listen(0, '127.0.0.1', resolve);
});
    const port = absent.address().port;
    await new Promise(resolve => {
 absent.close(resolve);
});
    const proxy = httpProxy.createProxyServer({ target: `http://127.0.0.1:${port}` });
    proxy.on('error', proxyError);
    const server = http.createServer((req, res) => {
        if (req.url === '/health') {
            res.end('ok');
        } else {
            proxy.web(req, res);
        }
    });
    await new Promise(resolve => {
 server.listen(0, '127.0.0.1', resolve);
});
    const request = (path) => new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${server.address().port}${path}`, res => {
            let body = '';
            res.on('data', chunk => {
 body += chunk;
});
            res.on('end', () => resolve({ status: res.statusCode, body }));
        }).on('error', reject);
    });
    try {
        expect(await request('/?action=snapshot')).toEqual({
            status: 503,
            body: 'Stream unavailable. Check that the camera is connected and its service is running.'
        });
        expect(await request('/health')).toEqual({ status: 200, body: 'ok' });
        expect((await request('/?action=stream')).status).toBe(503);
    } finally {
        proxy.close();
        await new Promise(resolve => {
 server.close(resolve);
});
    }
});

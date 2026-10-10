// A missing optional camera must not take down the machine-control server.
export default function proxyError(err, req, res) {
    if (res.headersSent) {
        res.destroy();
        return;
    }
    res.writeHead(503, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
    });
    res.end('Stream unavailable. Check that the camera is connected and its service is running.');
}

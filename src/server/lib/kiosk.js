// The touchscreen may obtain a local viewer identity, never an administrator.
export const kioskEnabled = () => process.env.CNCJS_KIOSK === '1' && process.env.CNCJS_BADGE_ACCESS !== '0';
export const isKiosk = user => !!user && user.role === 'kiosk';
export const isLoopback = address => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(address);
export const localKioskRequest = req => {
  const address = req.socket ? req.socket.remoteAddress : req.connection && req.connection.remoteAddress;
  if (!kioskEnabled() || !isLoopback(address)) {
    return false;
  }
  // Do not trust forwarded headers; reject DNS rebinding and cross-origin minting.
  const host = req.get('host');
  if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host || '')) {
    return false;
  }
  const origin = req.get('origin');
  return !origin || origin === `http://${host}` || origin === `https://${host}`;
};
export const kioskGuard = (req, res, next) => {
  if (isKiosk(req.user) && !localKioskRequest(req)) {
    res.status(403).send({ msg: 'Kiosk access requires the local machine and badge protection.' });
    return;
  }
  next();
};

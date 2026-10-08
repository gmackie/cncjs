import crypto from 'crypto';
import access from './service';
import store from '../../store';
import { createService } from '../fabforge/service';
import { configuration } from '../fabforge/client';

const fabforge = createService();
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
export const tokenFrom = (req) => req.get('X-CNCjs-Operator') || '';
export const checkLoadedFile = (session, gcode) => {
  if (
    !session ||
    !session.release ||
    typeof gcode !== 'string' ||
    sha256(gcode) !== session.release.sha256
  ) {
    const err = new Error(
      'Release this exact G-code file for setup before loading or starting it.'
    );
    err.status = 409;
    throw err;
  }
};
const respond = (action) => async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    res.send(await action(req));
  } catch (err) {
    res.status(err.status || 503).send({ msg: err.message });
  }
};
export const installRoutes = (app, prefix) => {
  app.get(
    `${prefix}/operator-access`,
    respond(async (req) => {
      await access.check();
      return access.status(tokenFrom(req));
    })
  );
  app.post(
    `${prefix}/operator-access/session`,
    respond((req) => access.badgeIn(req.body.badge))
  );
  app.delete(
    `${prefix}/operator-access/session`,
    respond((req) => access.badgeOut(tokenFrom(req)))
  );
  app.post(
    `${prefix}/operator-access/release`,
    respond(async (req) => {
      await access.requireOperator(tokenFrom(req), { motion: true });
      const review = await fabforge.review(
        req.body.workOrderId,
        req.body.jobId,
        req.body.source
      );
      if (review.hash !== req.body.hash) {
        throw new Error('G-code changed. Import and review it again.');
      }
      return access.release(tokenFrom(req), review);
    })
  );
  app.post(
    `${prefix}/operator-access/hold`,
    respond(() => {
      // A viewer may hold an existing Grbl controller, but never connect or resume it.
      const controllers = Object.values(store.get('controllers', {}));
      controllers.forEach((controller) => {
        if (controller.type === 'Grbl' && controller.isOpen()) {
          controller.workflow.pause();
          controller.write('!');
        }
      });
      return { requested: true };
    })
  );
};

export const httpGate =
  (service = access) => async (req, res, next) => {
    if (!service.enabled()) {
      next();
      return;
    }
    // This is mounted after normal CNCjs authentication and badge endpoints.
    const route = req.path.replace(/\/$/, '');
    const read = ['GET', 'HEAD'].includes(req.method);
    const readable =
      /^\/(state|tool|controllers|version\/latest|gcode(?:\/download)?|fabforge\/(?:status|work-orders(?:\/[^/]+)?))$/.test(
        route
      );
    const simulation =
      req.method === 'POST' &&
      /^\/fabforge\/work-orders\/[^/]+\/jobs\/[^/]+\/review$/.test(route);
    if ((read && readable) || simulation) {
      next();
      return;
    }
    try {
      // A machine badge is not a CNCjs administrator credential. Shell commands,
      // account edits, event hooks, arbitrary file writes and config writes stay blocked.
      const operatorRead = read && /^\/macros(?:\/[^/]+)?$/.test(route);
      const queueWrite =
        req.method === 'POST' &&
        /^\/fabforge\/work-orders\/[^/]+\/jobs\/[^/]+\/(validations|disposition)$/.test(
          route
        );
      const upload = req.method === 'POST' && route === '/gcode';
      if (!operatorRead && !queueWrite && !upload) {
        res
          .status(403)
          .send({
            msg: 'This endpoint is disabled in badge mode. Administrative changes require server maintenance.',
          });
        return;
      }
      const session = await service.requireOperator(tokenFrom(req), {
        motion: upload,
      });
      if (upload) {
        checkLoadedFile(session, req.body.gcode);
      }
      service.record(upload ? 'gcode_loaded' : 'operator_api', {
        method: req.method,
        route,
      });
      next();
    } catch (err) {
      res.status(err.status || 503).send({ msg: err.message });
    }
  };

export const socketGate = (socket, service = access, reviewService = fabforge, config = configuration) => {
  socket.on('operator:bind', (token, callback) => {
    socket.operatorToken =
      typeof token === 'string' && token.length <= 128 ? token : '';
    if (typeof callback === 'function') {
      callback({ authorized: service.status(socket.operatorToken).authorized });
    }
  });
  socket.use(async (packet, next) => {
    const [event, port, command, ...args] = packet;
    if (!service.enabled() || event === 'list' || event === 'operator:bind') {
      next();
      return;
    }
    try {
      if (!['open', 'close', 'command', 'write', 'writeln'].includes(event)) {
        throw new Error('Unsupported operator action.');
      }
      const session = await service.requireOperator(socket.operatorToken, {
        motion: true,
      });
      const commands = [
        'gcode:load',
        'gcode:unload',
        'gcode:start',
        'gcode:stop',
        'gcode:pause',
        'gcode:resume',
        'start',
        'stop',
        'pause',
        'resume',
        'feeder:feed',
        'feeder:start',
        'feeder:stop',
        'feedhold',
        'cyclestart',
        'statusreport',
        'homing',
        'sleep',
        'unlock',
        'reset',
        'jogCancel',
        'feedOverride',
        'spindleOverride',
        'rapidOverride',
        'lasertest:on',
        'lasertest:off',
        'gcode',
        'macro:run-reviewed',
      ];
      if (event === 'command' && !commands.includes(command)) {
        throw new Error('This command is disabled in badge mode.');
      }
      if (event === 'command' && ['gcode:load', 'load'].includes(command)) {
        checkLoadedFile(session, args[1]);
      }
      if (
        event === 'command' &&
        [
          'gcode:start',
          'start',
          'gcode:resume',
          'resume',
          'cyclestart',
        ].includes(command)
      ) {
        const controller = store.get(`controllers[${JSON.stringify(port)}]`);
        checkLoadedFile(session, controller && controller.sender.state.gcode);
        const detail = await reviewService.detail(session.release.workOrderId);
        const job = detail.jobs.find(item => item.id === session.release.jobId);
        if (detail.workOrder.status !== 'ready' || !job || job.status !== 'queued' || job.resourceId !== config().resourceId) {
          throw new Error('Released job is no longer ready and queued in FabForge.');
        }
        // Remote revalidation can outlive the lease; recheck before forwarding.
        await service.requireOperator(socket.operatorToken, { motion: true });
      }
      service.record('machine_action', { action: event, command: event === 'command' ? command : undefined });
      next();
    } catch (err) {
      socket.emit('operator:denied', { msg: err.message });
      const callback = packet[packet.length - 1];
      if (typeof callback === 'function') {
        callback({ message: err.message });
      }
      // Do not forward a denied packet to the command handler.
    }
  });
};

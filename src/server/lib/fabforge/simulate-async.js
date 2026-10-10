import path from 'path';
import { Worker } from 'worker_threads';
import { FabForgeError } from './client';

let active = false;
// Keep parsing off the serial sender's event loop, with bounded concurrency/memory.
export default function simulateAsync(gcode) {
  if (active) {
    return Promise.reject(new FabForgeError('Another backplot is running. Try again shortly.', 429));
  }
  if (typeof gcode !== 'string' || Buffer.byteLength(gcode) > 2 * 1024 * 1024) {
    return Promise.reject(new FabForgeError('G-code must be text up to 2 MiB.', 413));
  }
  active = true;
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(path.join(__dirname, 'simulation-worker.js'), {
        workerData: gcode,
        resourceLimits: { maxOldGenerationSizeMb: 96 }
      });
    } catch (err) {
      active = false;
      reject(new FabForgeError('Could not start offline simulator.', 503));
      return;
    }
    let settled = false;
    const finish = (error, result) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      worker.terminate().finally(() => {
        active = false;
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
    };
    const timer = setTimeout(() => finish(new FabForgeError('Simulation timed out. Use a smaller file.', 422)), 10000);
    worker.once('message', (message) => finish(message.error ? new FabForgeError(message.error, 422) : null, message.result));
    worker.once('error', () => finish(new FabForgeError('Offline simulator failed.', 422)));
    worker.once('exit', () => {
      if (!settled) {
        finish(new FabForgeError('Offline simulator exited unexpectedly.', 422));
      }
    });
  });
}

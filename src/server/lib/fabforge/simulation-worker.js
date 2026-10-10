// CommonJS keeps this worker runnable in source tests and the compiled server.
const { parentPort, workerData } = require('worker_threads');
const simulate = require('./simulate');

try {
  parentPort.postMessage({ result: simulate(workerData) });
} catch (err) {
  parentPort.postMessage({ error: err.message });
}

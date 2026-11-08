import assert from 'node:assert/strict';
import { parentPort, workerData } from 'node:worker_threads';
import { removeRecentFeatures } from './older-runtime.ts';

removeRecentFeatures();
assert.equal(typeof Promise.withResolvers, 'undefined');
// A real separate worker realm: main-thread polyfills cannot help this import.
const { WorkerMessageHandler } = await import('pdfjs-dist/legacy/build/pdf.worker.mjs');
assert.equal(typeof Promise.withResolvers, 'function');
assert.equal(typeof Promise.try, 'function');
assert.equal(typeof Reflect.get(Uint8Array.prototype, 'toHex'), 'function');
workerData.port.start();
WorkerMessageHandler.initializeFromPort(workerData.port);
parentPort!.postMessage('compatibility-worker-ready');

declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs' {
  export class WorkerMessageHandler {
    static initializeFromPort(port: import('node:worker_threads').MessagePort): void;
  }
}

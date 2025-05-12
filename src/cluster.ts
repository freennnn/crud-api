import cluster, { Worker } from "node:cluster";
import http from "node:http";
import { cpus } from "node:os";
import { URL } from "node:url";
import dotenv from "dotenv";
import Server from "./server.js";

dotenv.config();

// Debug: Log all environment variables
console.log("Environment variables:", {
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  WORKER_PORT: process.env.WORKER_PORT,
});

const PORT = parseInt(process.env.PORT || "4000", 10);
console.log(`Using port ${PORT} for load balancer`);

const WORKER_COUNT = Math.max(1, cpus().length - 1); // Leave one CPU for the load balancer

if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);
  console.log(`Forking for ${WORKER_COUNT} workers`);

  // Create workers
  const workers: Worker[] = [];
  for (let i = 0; i < WORKER_COUNT; i++) {
    const worker = cluster.fork({ WORKER_PORT: PORT + i + 1 });
    workers.push(worker);
  }

  // Load balancer state
  let currentWorkerIndex = 0;

  // Create load balancer server
  const loadBalancer = http.createServer((req, res) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);

    // Update worker index for next request (Round-robin)
    currentWorkerIndex = (currentWorkerIndex + 1) % workers.length;
    const workerPort = PORT + currentWorkerIndex + 1;

    // Forward the request to the selected worker
    const options = {
      hostname: "localhost",
      port: workerPort,
      path: url.pathname + url.search,
      method: req.method,
      headers: {
        ...req.headers,
        "x-forwarded-for": req.socket.remoteAddress,
        "x-forwarded-proto": "http",
        "x-forwarded-host": req.headers.host,
      },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on("error", (error) => {
      console.error(`Proxy request error to worker ${workerPort}:`, error);
      res.writeHead(500);
      res.end("Internal Server Error");
    });

    // Forward the request body if it exists
    req.pipe(proxyReq);
  });

  // Start load balancer
  loadBalancer.listen(PORT, "0.0.0.0", () => {
    console.log(`Load balancer listening on port ${PORT}`);
    console.log(
      `Workers running on ports ${Array.from({ length: WORKER_COUNT }, (_, i) => PORT + i + 1).join(", ")}`
    );
  });

  // Handle worker events
  cluster.on("exit", (worker, code, signal) => {
    const workerIndex = workers.indexOf(worker);
    console.log(
      `Worker ${worker.process.pid} (port ${PORT + workerIndex + 1}) died with code ${code} and signal ${signal}`
    );
    console.log("Starting a new worker");
    const newWorker = cluster.fork({
      WORKER_PORT: PORT + workerIndex + 1,
    });
    workers[workerIndex] = newWorker;
  });
} else {
  // Worker process
  const workerPort = parseInt(process.env.WORKER_PORT || "4001", 10);
  console.log(`Worker ${process.pid} started on port ${workerPort}`);

  // Start worker server
  const app = new Server(workerPort);
  app.start();
}

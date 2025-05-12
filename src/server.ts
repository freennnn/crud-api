import http, { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import dotenv from "dotenv";
import { sendError, isValidUUID } from "./utils/responseUtils.js";

dotenv.config();

const DB_SERVER_PORT = 5005;

export default class Server {
  private port: number;

  constructor(port?: number) {
    const calculatedPort =
      port ??
      parseInt(process.env.WORKER_PORT || process.env.PORT || "4001", 10);
    this.port = calculatedPort;
  }

  private proxyRequestToDB = (req: IncomingMessage, res: ServerResponse) => {
    const options = {
      hostname: "localhost",
      port: DB_SERVER_PORT,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `localhost:${DB_SERVER_PORT}`,
        connection: "keep-alive",
      },
    };

    const proxyReq = http.request(options, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      proxyRes.pipe(res, { end: true });
    });

    proxyReq.on("error", (error) => {
      console.error(
        `Worker proxy request to DB server failed: ${error.message}`
      );
      sendError(res, {
        statusCode: 502,
        message: "Bad Gateway: Cannot connect to database service",
      });
    });

    req.pipe(proxyReq, { end: true });
  };

  private handleRequest = async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const pathParts = url.pathname.split("/").filter(Boolean);

      if (pathParts[0] === "api" && pathParts[1] === "users") {
        const userId = pathParts[2];

        if (userId && !isValidUUID(userId)) {
          sendError(res, {
            statusCode: 400,
            message: "Invalid user ID format",
          });
          return;
        }

        this.proxyRequestToDB(req, res);
      } else {
        sendError(res, { statusCode: 404, message: "Not Found" });
      }
    } catch (error) {
      console.error("Worker Server error:", error);
      if (!res.headersSent) {
        sendError(res, { statusCode: 500, message: "Internal server error" });
      }
    }
  };

  public start() {
    const server = http.createServer(this.handleRequest.bind(this));

    server.on("error", (error: NodeJS.ErrnoException) => {
      console.error(
        `[Worker Server ERROR] Failed to start server on port ${this.port}: ${error.message}`
      );
      if (error.code === "EADDRINUSE") {
        console.error(
          `[Worker Server ERROR] Port ${this.port} is already in use.`
        );
      }
    });

    server.listen(this.port, "0.0.0.0", () => {
      // No debug logs
    });

    return server;
  }
}

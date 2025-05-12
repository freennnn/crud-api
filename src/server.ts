import http, { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import dotenv from "dotenv";
import { userService } from "./services/userService.js";
import {
  sendResponse,
  sendError,
  isValidUUID,
  validateUserInput,
} from "./utils/responseUtils.js";
//import { ErrorResponse } from "./types/user.js";

dotenv.config();

export default class Server {
  private port: number;

  constructor() {
    this.port = parseInt(process.env.PORT || "3000", 10);
  }

  private getBody = async (request: IncomingMessage): Promise<string> => {
    return new Promise((resolve, reject) => {
      let body = "";
      request.on("data", (chunk) => {
        body += chunk.toString();
      });
      request.on("end", () => {
        resolve(body);
      });
      request.on("error", (error) => {
        reject(error);
      });
    });
  };

  private handleGetUsers = (res: ServerResponse) => {
    const users = userService.getAllUsers();
    sendResponse(res, 200, users);
  };

  private handleGetUserById = (userId: string, res: ServerResponse) => {
    if (!isValidUUID(userId)) {
      sendError(res, { statusCode: 400, message: "Invalid user ID format" });
      return;
    }

    const user = userService.getUserById(userId);
    if (!user) {
      sendError(res, { statusCode: 404, message: "User not found" });
      return;
    }

    sendResponse(res, 200, user);
  };

  private handleCreateUser = async (
    req: IncomingMessage,
    res: ServerResponse
  ) => {
    try {
      const body = await this.getBody(req);
      const userData = JSON.parse(body);

      const validation = validateUserInput(userData);
      if (!validation.isValid) {
        sendError(res, { statusCode: 400, message: validation.message! });
        return;
      }

      const newUser = userService.createUser(userData);
      sendResponse(res, 201, newUser);
    } catch (error) {
      sendError(res, { statusCode: 400, message: "Invalid request body" });
    }
  };

  private handleUpdateUser = async (
    userId: string,
    req: IncomingMessage,
    res: ServerResponse
  ) => {
    if (!isValidUUID(userId)) {
      sendError(res, { statusCode: 400, message: "Invalid user ID format" });
      return;
    }

    try {
      const body = await this.getBody(req);
      const userData = JSON.parse(body);

      const validation = validateUserInput(userData);
      if (!validation.isValid) {
        sendError(res, { statusCode: 400, message: validation.message! });
        return;
      }

      const updatedUser = userService.updateUser(userId, userData);
      if (!updatedUser) {
        sendError(res, { statusCode: 404, message: "User not found" });
        return;
      }

      sendResponse(res, 200, updatedUser);
    } catch (error) {
      sendError(res, { statusCode: 400, message: "Invalid request body" });
    }
  };

  private handleDeleteUser = (userId: string, res: ServerResponse) => {
    if (!isValidUUID(userId)) {
      sendError(res, { statusCode: 400, message: "Invalid user ID format" });
      return;
    }

    const deleted = userService.deleteUser(userId);
    if (!deleted) {
      sendError(res, { statusCode: 404, message: "User not found" });
      return;
    }

    res.writeHead(204);
    res.end();
  };

  private handleRequest = async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url || "", `http://${req.headers.host}`);
      const pathParts = url.pathname.split("/").filter(Boolean);

      // Handle /api/users endpoints
      if (pathParts[0] === "api" && pathParts[1] === "users") {
        const userId = pathParts[2];

        switch (req.method) {
          case "GET":
            if (userId) {
              this.handleGetUserById(userId, res);
            } else {
              this.handleGetUsers(res);
            }
            break;

          case "POST":
            if (!userId) {
              await this.handleCreateUser(req, res);
            } else {
              sendError(res, { statusCode: 404, message: "Not found" });
            }
            break;

          case "PUT":
            if (userId) {
              await this.handleUpdateUser(userId, req, res);
            } else {
              sendError(res, { statusCode: 404, message: "Not found" });
            }
            break;

          case "DELETE":
            if (userId) {
              this.handleDeleteUser(userId, res);
            } else {
              sendError(res, { statusCode: 404, message: "Not found" });
            }
            break;

          default:
            sendError(res, { statusCode: 405, message: "Method not allowed" });
        }
      } else {
        sendError(res, { statusCode: 404, message: "Not found" });
      }
    } catch (error) {
      console.error("Server error:", error);
      sendError(res, { statusCode: 500, message: "Internal server error" });
    }
  };

  public start() {
    const server = http.createServer(this.handleRequest.bind(this));

    server.listen(this.port, "0.0.0.0", () => {
      console.log(`Server is running on port ${this.port}`);
    });

    return server;
  }
}

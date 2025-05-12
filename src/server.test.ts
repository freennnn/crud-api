import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import Server from "./server.js";

let serverInstance: http.Server;
let port: number;

beforeAll(async () => {
  // Start the server on a random port
  const app = new Server(0);
  serverInstance = app.start();
  // Wait for server to start and get the port
  await new Promise<void>((resolve) => {
    serverInstance.on("listening", () => {
      const address = serverInstance.address();
      port = typeof address === "object" && address ? address.port : 3000;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    serverInstance.close(() => resolve());
  });
});

function makeRequest(
  method: string,
  path: string,
  data?: any
): Promise<{ status: number; body: any }> {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: "localhost",
        port,
        path,
        method,
        headers: data ? { "Content-Type": "application/json" } : undefined,
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          let parsed;
          try {
            parsed = body ? JSON.parse(body) : undefined;
          } catch {
            parsed = body;
          }
          resolve({ status: res.statusCode || 0, body: parsed });
        });
      }
    );
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

describe("User API", () => {
  let userId: string;

  it("should return an empty array initially", async () => {
    const res = await makeRequest("GET", "/api/users");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("should create a new user", async () => {
    const user = { username: "Alice", age: 30, hobbies: ["reading"] };
    const res = await makeRequest("POST", "/api/users", user);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject(user);
    expect(res.body).toHaveProperty("id");
    userId = res.body.id;
  });

  it("should get user by id", async () => {
    const res = await makeRequest("GET", `/api/users/${userId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(userId);
  });

  it("should update user", async () => {
    const updatedUser = {
      username: "Alice Updated",
      age: 31,
      hobbies: ["reading", "coding"],
    };
    const res = await makeRequest("PUT", `/api/users/${userId}`, updatedUser);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject(updatedUser);
    expect(res.body.id).toBe(userId);
  });

  it("should delete user", async () => {
    const res = await makeRequest("DELETE", `/api/users/${userId}`);
    expect(res.status).toBe(204);
  });

  it("should return 404 when getting deleted user", async () => {
    const res = await makeRequest("GET", `/api/users/${userId}`);
    expect(res.status).toBe(404);
  });
});

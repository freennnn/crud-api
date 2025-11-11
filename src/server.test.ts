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

  // Clean up database once before all tests
  try {
    const users = await makeRequest("GET", "/api/users");
    if (Array.isArray(users.body)) {
      for (const user of users.body) {
        await makeRequest("DELETE", `/api/users/${user.id}`);
      }
    }
  } catch (error) {
    // Ignore errors if DB server is not running
    console.warn("Could not clean database. Is DB server running?");
  }
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

  it("should return 400 when creating user with missing fields", async () => {
    const invalidUser = { username: "Bob" }; // missing age and hobbies
    const res = await makeRequest("POST", "/api/users", invalidUser);
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("should return 400 when userId is not a valid UUID", async () => {
    const res = await makeRequest("GET", "/api/users/invalid-uuid-format");
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("message");
  });

  it("should return 404 for non-existing endpoints", async () => {
    const res = await makeRequest("GET", "/some-non/existing/resource");
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("message");
  });

  it("should return 400 when updating user with invalid UUID", async () => {
    const userData = { username: "Test", age: 25, hobbies: ["test"] };
    const res = await makeRequest("PUT", "/api/users/not-a-uuid", userData);
    expect(res.status).toBe(400);
  });

  it("should return 400 when deleting user with invalid UUID", async () => {
    const res = await makeRequest("DELETE", "/api/users/12345");
    expect(res.status).toBe(400);
  });

  it("should return 404 when updating non-existent user", async () => {
    const validUuid = "00000000-0000-0000-0000-000000000000";
    const userData = { username: "Test", age: 25, hobbies: ["test"] };
    const res = await makeRequest("PUT", `/api/users/${validUuid}`, userData);
    expect(res.status).toBe(404);
  });

  it("should return 404 when deleting non-existent user", async () => {
    const validUuid = "00000000-0000-0000-0000-000000000000";
    const res = await makeRequest("DELETE", `/api/users/${validUuid}`);
    expect(res.status).toBe(404);
  });

  it("should accept age of 0", async () => {
    const user = { username: "Baby", age: 0, hobbies: [] };
    const res = await makeRequest("POST", "/api/users", user);
    expect(res.status).toBe(201);
    expect(res.body.age).toBe(0);
    // Cleanup
    await makeRequest("DELETE", `/api/users/${res.body.id}`);
  });

  it("should accept empty hobbies array", async () => {
    const user = { username: "NoHobbies", age: 20, hobbies: [] };
    const res = await makeRequest("POST", "/api/users", user);
    expect(res.status).toBe(201);
    expect(res.body.hobbies).toEqual([]);
    // Cleanup
    await makeRequest("DELETE", `/api/users/${res.body.id}`);
  });
});

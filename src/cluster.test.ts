import { describe, it, expect, beforeAll, afterAll } from "vitest";
import http from "node:http";
import { spawn } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import dotenv from "dotenv";

// Load .env file
dotenv.config();

// Use PORT from .env or default to 4000
const PORT = parseInt(process.env.PORT || "4000", 10);

describe("Cluster Implementation", () => {
  let clusterProcess: ReturnType<typeof spawn>;
  let userId: string;

  // Helper function to make HTTP requests
  async function makeRequest(
    method: string,
    path: string,
    data?: any
  ): Promise<{ status: number; body: any }> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: "localhost",
          port: PORT,
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

      req.on("error", reject);
      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }

  // Helper to wait for server to be ready
  async function waitForServer(): Promise<void> {
    const maxAttempts = 20; // Increased from 10 to 20
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await makeRequest("GET", "/api/users");
        console.log(`Server ready on attempt ${i + 1}, status: ${response.status}`);
        return;
      } catch (error) {
        console.log(`Attempt ${i + 1}/${maxAttempts} failed:`, error instanceof Error ? error.message : String(error));
        await setTimeout(1000); // Wait 1 second between attempts
      }
    }
    throw new Error("Server failed to start after 20 attempts. Is DB server running on port 5005?");
  }

  beforeAll(async () => {
    // Start the cluster with same PORT as test (from .env)
    clusterProcess = spawn(
      "node",
      ["dist/cluster.js"],
      {
        stdio: "pipe",
        env: {
          ...process.env,
          PORT: String(PORT), // Ensure cluster uses same PORT as test
        },
      }
    );

    // Log cluster output
    clusterProcess.stdout?.on("data", (data) => {
      console.log(`Cluster stdout: ${data}`);
    });
    clusterProcess.stderr?.on("data", (data) => {
      console.error(`Cluster stderr: ${data}`);
    });

    // Wait for server to be ready
    await waitForServer();

    // Clean up database once before all tests
    try {
      const users = await makeRequest("GET", "/api/users");
      if (Array.isArray(users.body)) {
        for (const user of users.body) {
          await makeRequest("DELETE", `/api/users/${user.id}`);
        }
      }
    } catch (error) {
      console.warn("Could not clean database. Is DB server running?");
    }
  }, 40000); // Increased timeout for 20 attempts

  afterAll(async () => {
    // Cleanup: kill the cluster process
    clusterProcess.kill();
    await new Promise((resolve) => clusterProcess.on("exit", resolve));
  }, 10000);

  it("should return empty array initially", async () => {
    const res = await makeRequest("GET", "/api/users");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("should create a new user", async () => {
    const userData = {
      username: "testuser",
      age: 25,
      hobbies: ["reading"],
    };

    const res = await makeRequest("POST", "/api/users", userData);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject(userData);
    expect(res.body).toHaveProperty("id");
    userId = res.body.id;
  });

  it("should get user by id", async () => {
    const res = await makeRequest("GET", `/api/users/${userId}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(userId);
  });

  it("should update user", async () => {
    const updatedData = {
      username: "updateduser",
      age: 26,
      hobbies: ["reading", "coding"],
    };

    const res = await makeRequest("PUT", `/api/users/${userId}`, updatedData);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject(updatedData);
    expect(res.body.id).toBe(userId);
  });

  it("should verify update from any worker", async () => {
    const res = await makeRequest("GET", `/api/users/${userId}`);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe("updateduser");
    expect(res.body.age).toBe(26);
    expect(res.body.hobbies).toEqual(["reading", "coding"]);
  });

  it("should delete user", async () => {
    const res = await makeRequest("DELETE", `/api/users/${userId}`);
    expect(res.status).toBe(204);
  });

  it("should return 404 for deleted user", async () => {
    const res = await makeRequest("GET", `/api/users/${userId}`);
    expect(res.status).toBe(404);
  });

  it("should distribute requests across workers", async () => {
    // Create a new user for this test
    const userData = {
      username: "loadtest",
      age: 30,
      hobbies: ["testing"],
    };

    const createRes = await makeRequest("POST", "/api/users", userData);
    const testUserId = createRes.body.id;

    // Make multiple requests and collect responses
    const requests = Array.from({ length: 10 }, () =>
      makeRequest("GET", `/api/users/${testUserId}`)
    );

    const responses = await Promise.all(requests);

    // All requests should succeed
    responses.forEach((res) => {
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(testUserId);
    });

    // Cleanup
    await makeRequest("DELETE", `/api/users/${testUserId}`);
  });

  it("should handle invalid user id", async () => {
    const res = await makeRequest("GET", "/api/users/invalid-id");
    expect(res.status).toBe(400);
  });

  it("should handle non-existent user", async () => {
    const res = await makeRequest(
      "GET",
      "/api/users/00000000-0000-0000-0000-000000000000"
    );
    expect(res.status).toBe(404);
  });
});

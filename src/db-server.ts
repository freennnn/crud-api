import http from "node:http";
import { URL } from "node:url";
import { UserService } from "./services/userService.js";
import { UserInput } from "./types/user.js";

const DB_PORT = 5005;

const userService = new UserService();

const dbServer = http.createServer((req, res) => {
  const url = new URL(req.url || "", `http://${req.headers.host}`);
  const { pathname } = url;

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  let body: string = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    let parsedBody: any = {};
    if (body) {
      try {
        parsedBody = JSON.parse(body);
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid JSON in request body" }));
        return;
      }
    }

    console.log("DB Server received:", req.method, pathname, parsedBody);

    if (pathname === "/api/users") {
      if (req.method === "GET") {
        const allUsers = userService.getAllUsers();
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(allUsers));
      } else if (req.method === "POST") {
        const { username, age, hobbies } = parsedBody as UserInput;
        if (
          username === undefined ||
          age === undefined ||
          hobbies === undefined
        ) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: "Missing required fields: username, age, hobbies",
            })
          );
          return;
        }
        const newUser = userService.createUser({ username, age, hobbies });
        res.writeHead(201, { "Content-Type": "application/json" });
        res.end(JSON.stringify(newUser));
      } else {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method not allowed" }));
      }
    } else if (pathname.startsWith("/api/users/")) {
      const id = pathname.split("/")[3];

      const userId = id as string;
      const user = userService.getUserById(userId);

      if (!user) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "User not found" }));
        return;
      }

      if (req.method === "GET") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(user));
      } else if (req.method === "PUT") {
        const { username, age, hobbies } = parsedBody as UserInput;
        if (
          username === undefined ||
          age === undefined ||
          hobbies === undefined
        ) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error:
                "Missing required fields for update: username, age, hobbies",
            })
          );
          return;
        }
        const updatedUser = userService.updateUser(userId, {
          username,
          age,
          hobbies,
        });
        if (updatedUser) {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(updatedUser));
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "User not found for update" }));
        }
      } else if (req.method === "DELETE") {
        const deleted = userService.deleteUser(userId);
        if (deleted) {
          res.writeHead(204);
          res.end();
        } else {
          res.writeHead(404, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "User not found for delete" }));
        }
      } else {
        res.writeHead(405, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Method not allowed" }));
      }
    } else {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
    }
  });
});

dbServer.listen(DB_PORT, () => {
  console.log(`DB Server (in-memory database) listening on port ${DB_PORT}`);
});

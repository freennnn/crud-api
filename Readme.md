# CRUD API

A simple CRUD API implementation using Node.js and TypeScript with in-memory database.

## Running the Application

This application can be run in different modes:

1. **Build:** First, build the project to generate JavaScript files in the `dist/` directory:

    ```bash
    npm run build
    ```

2. **Run Modes:**

    * **Standalone DB Server (Required for other modes):**
        Starts the dedicated in-memory database server (listens on port 5005 by default).

        ```bash
        # Run in a separate terminal and keep it running
        npm run start:db 
        ```

    * **Single Server Mode:**
        Runs a single instance of the application server (listens on port 4001 by default). Requires the DB server to be running.

        ```bash
        # Requires npm run start:db to be running in another terminal
        npm run start
        ```

    * **Clustered Mode (Load Balancing):**
        Runs the load balancer (listens on port 4000 by default) which distributes requests to multiple worker instances (ports 4001+). Requires the DB server to be running.

        ```bash
        # Requires npm run start:db to be running in another terminal
        npm run start:multi
        ```

## Testing

**⚠️ IMPORTANT: The DB server must be running before running tests!**

* **Run API Tests (default):**

    ```bash
    # Terminal 1: Start DB server (REQUIRED)
    npm run build
    npm run start:db
    
    # Terminal 2: Run API tests (excludes cluster tests)
    npm test
    ```

* **Run Cluster Tests:**
    These tests specifically target the clustered mode functionality.

    ```bash
    # Terminal 1: Ensure the DB server is running
    npm run build
    npm run start:db
    
    # Terminal 2: Run cluster tests
    npm run test:cluster
    ```

    *(Note: The `test:cluster` script automatically starts and stops the main cluster (load balancer + workers) for the test duration, but it does **not** manage the separate DB server.)*

* **Run ALL Tests (API + Cluster):**

    ```bash
    # Terminal 1: Ensure the DB server is running
    npm run build
    npm run start:db
    
    # Terminal 2: Run all tests
    npm run test:all
    ```

## API Endpoints

### Users

* `GET /api/users` - Get all users
* `GET /api/users/{userId}` - Get user by ID
* `POST /api/users` - Create a new user
* `PUT /api/users/{userId}` - Update an existing user
* `DELETE /api/users/{userId}` - Delete a user

### Request/Response Format

#### User Object

```json
{
  "id": "uuid",
  "username": "string",
  "age": number,
  "hobbies": ["string"]
}
```

#### Create/Update User Request

```json
{
  "username": "string",
  "age": number,
  "hobbies": ["string"]
}
```

### Status Codes

* 200 - OK
* 201 - Created
* 204 - No Content
* 400 - Bad Request
* 404 - Not Found
* 500 - Internal Server Error

## Error Handling

The API includes comprehensive error handling for:

* Invalid UUIDs
* Missing or invalid request body
* Non-existent resources
* Server errors

All error responses include a message explaining the error.

## Horizontal Scaling with Node.js Cluster Module and Dedicated DB Server

This project implements horizontal scaling using the Node.js `cluster` module to run multiple instances (workers) of the application server. To ensure data consistency across these workers, a dedicated in-memory database server is used.

### 1. The Goal

To handle more simultaneous requests by running multiple instances (workers) of our application server, coordinated by a primary process (load balancer). The challenge is ensuring all workers access the *same* user data.

### 2. The Problem (Without DB Server)

Initially, each worker would have its own `UserService` instance and its own in-memory list of users. A user created by Worker 1 wouldn't exist for Worker 2, leading to data inconsistencies and errors.

### 3. The Solution: Centralized Database Server (`src/db-server.ts`)

* **Separate Process:** A dedicated server (`src/db-server.ts`) runs as its own Node.js process (started with `npm run start:db`).
* **Single Source of Truth:** This server listens on a specific port (default: 5000). It creates **one** instance of `UserService` (from `src/services/userService.ts`) and manages the user data (currently in memory within *this single* process).
* **API for Data:** It exposes simple HTTP endpoints (`/api/users`, `/api/users/{userId}`) that perform the actual CRUD operations using its `UserService`. Any request to `http://localhost:5000/api/users` will interact with this single, shared dataset.

### 4. Cluster Manager / Load Balancer (`src/cluster.ts`)

* **Entry Point:** This is what we run with `npm run start:multi`.
* **Primary Process:** The script checks if it's the primary process (`cluster.isPrimary`).
* **Forking Workers:** If it's the primary, it determines the number of CPU cores (typically `cpus().length - 1` to leave one for the primary/load balancer) and forks multiple "worker" processes. It assigns a unique port to each worker (e.g., 4001, 4002, ...) by setting the `WORKER_PORT` environment variable for the child process.
* **Listening for Clients:** The primary process starts its *own* HTTP server listening on the main application port (default: 4000). This server acts as the **load balancer**.
* **Distributing Requests:** When the load balancer (port 4000) receives a request from a client:
  * It picks one of the worker processes (using a simple round-robin method in the current implementation).
  * It **forwards (proxies)** the *entire* incoming request (path, method, headers, body) to the chosen worker's specific port (e.g., `http://localhost:4001/api/users`).
  * It waits for the worker's response and sends that response back to the original client.
* **Worker Management:** The primary process also listens for `exit` events from workers and can restart them if they crash, ensuring high availability.

### 5. Worker Server (`src/server.ts`)

* **Worker Processes:** These are the child processes forked by the cluster manager. Each runs the code defined in `src/server.ts`.
* **Listening:** Each worker starts an HTTP server listening on the unique port assigned to it by the primary process (e.g., 4001, 4002, etc., based on `process.env.WORKER_PORT`).
* **Receiving Proxied Requests:** Workers primarily receive requests that have been forwarded to them by the load balancer.
* **Handling Requests (Proxy to DB Server):**
  * When a worker receives a request (e.g., `GET /api/users` on its assigned port like 4001):
  * It checks if the request path is for the user API (e.g., starts with `/api/users`).
  * If it is, **it does not use a local `UserService` instance.** Instead, it acts as another **proxy**.
  * It forwards the request it received on to the **DB Server** (e.g., `http://localhost:5000/api/users`).
  * It waits for the DB Server's response.
  * It then sends the DB Server's response back to the Load Balancer (which originally sent the request to this worker).
  * If the path is *not* for `/api/users`, it handles it directly (e.g., by sending a 404 Not Found error).

### 6. Overall Request Flow (Example: Client makes a `POST /api/users` request)

1. Client sends request to `http://localhost:4000/api/users` (Load Balancer - `src/cluster.ts` on port 4000).
2. Load Balancer receives the request, picks a worker (e.g., Worker 3 running on port 4003), and proxies the request to `http://localhost:4003/api/users`.
3. Worker 3 (`src/server.ts` instance on port 4003) receives the request. It identifies the path as `/api/users` and proxies the request to `http://localhost:5000/api/users` (DB Server - `src/db-server.ts`).
4. The DB Server (on port 5000) receives the request, uses its `UserService` instance to process the `POST` request (create a new user), and sends a `201 Created` response (with the new user data) back to Worker 3.
5. Worker 3 receives the `201 Created` response from the DB Server and sends it back to the Load Balancer.
6. The Load Balancer receives the `201 Created` response from Worker 3 and sends it back to the original Client.

#### Shorter scheme

1. Client -> `http://localhost:4000/api/users` (Load Balancer)
2. Load Balancer -> Picks Worker 3 -> `http://localhost:4003/api/users` (Worker)
3. Worker 3 -> Sees `/api/users` -> `http://localhost:5000/api/users` (DB Server)
4. DB Server -> Uses its UserService -> Creates user -> Sends `201 Created` response back to Worker 3.
5. Worker 3 -> Sends `201 Created` response back to Load Balancer.
6. Load Balancer -> Sends `201 Created` response back to Client.

### Summary

This multi-tier architecture ensures that even though we have multiple workers handling requests concurrently, they all rely on the single DB Server process for user data, maintaining consistency.

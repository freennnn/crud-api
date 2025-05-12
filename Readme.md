# CRUD API

A simple CRUD API implementation using Node.js and TypeScript with in-memory database.

## Requirements

- Node.js 22.x.x (22.14.0 or higher)
- npm or yarn

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory with the following content:
   ```
   PORT=3000
   NODE_ENV=development
   ```

## Available Scripts

- `npm run start:dev` - Start the server in development mode with hot reload
- `npm run start:prod` - Build and start the server in production mode
- `npm run build` - Build the project for production
- `npm run lint` - Run ESLint to check and fix code style
- `npm run format` - Format code using Prettier
- `npm test` - Run tests

## API Endpoints

### Users

- `GET /api/users` - Get all users
- `GET /api/users/{userId}` - Get user by ID
- `POST /api/users` - Create a new user
- `PUT /api/users/{userId}` - Update an existing user
- `DELETE /api/users/{userId}` - Delete a user

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

- 200 - OK
- 201 - Created
- 204 - No Content
- 400 - Bad Request
- 404 - Not Found
- 500 - Internal Server Error

## Error Handling

The API includes comprehensive error handling for:
- Invalid UUIDs
- Missing or invalid request body
- Non-existent resources
- Server errors

All error responses include a message explaining the error.

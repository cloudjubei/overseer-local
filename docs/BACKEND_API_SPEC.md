# Backend API Specification

This document outlines the design and specification for the backend API that will support the multi-platform application (Electron, Web, Mobile).

## 1. Authentication and Authorization

### 1.1. Authentication Strategy

Authentication will be handled using JSON Web Tokens (JWT).

**Flow:**

1.  Client sends `email` and `password` to a `POST /api/v1/auth/login` endpoint.
2.  The server validates the credentials.
3.  If valid, the server generates a short-lived `accessToken` and a long-lived `refreshToken`.
4.  The `accessToken` is sent with every subsequent API request in the `Authorization` header: `Authorization: Bearer <accessToken>`.
5.  When the `accessToken` expires, the client uses the `refreshToken` to get a new `accessToken` from a `POST /api/v1/auth/refresh` endpoint without requiring the user to log in again.

### 1.2. Authorization

Authorization will be based on resource ownership. A user can only access and modify resources (projects, tasks, etc.) that they own or have been granted access to.

- Requests to endpoints like `/api/v1/projects/{projectId}` will check if the authenticated user has permission to access that project.
- Future iterations may introduce more granular role-based access control (RBAC) with roles like `admin`, `editor`, `viewer` within a project.

## 2. API Versioning

The API will be versioned via the URL path. The initial version will be `v1`.

**Example:** `https://api.yourapp.com/api/v1/...

This ensures that future breaking changes can be introduced in new versions (`v2`, `v3`, etc.) without affecting existing clients.

## 3. Database Schema & Data Models

Below are the core data models for the application. The database schema will be derived from these models.

### User

```json
{
  "id": "user_uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "createdAt": "2023-10-27T10:00:00Z",
  "updatedAt": "2023-10-27T10:00:00Z"
}
```

### Project

```json
{
  "id": "project_uuid",
  "ownerId": "user_uuid",
  "name": "My First Project",
  "description": "This is a project description.",
  "createdAt": "2023-10-27T10:00:00Z",
  "updatedAt": "2023-10-27T10:00:00Z"
}
```

### Task

```json
{
  "id": "task_uuid",
  "projectId": "project_uuid",
  "title": "Implement the API spec",
  "description": "Write the backend API spec document.",
  "status": "in_progress", // e.g., 'todo', 'in_progress', 'done'
  "dueDate": "2023-11-10T18:00:00Z",
  "createdAt": "2023-10-27T10:00:00Z",
  "updatedAt": "2023-10-27T10:00:00Z"
}
```

### Document

```json
{
  "id": "doc_uuid",
  "projectId": "project_uuid",
  "title": "Project Plan",
  "content": "...", // Markdown or other format
  "createdAt": "2023-10-27T10:00:00Z",
  "updatedAt": "2023-10-27T10:00:00Z"
}
```

### File

```json
{
  "id": "file_uuid",
  "projectId": "project_uuid",
  "name": "screenshot.png",
  "mimeType": "image/png",
  "size": 102400, // in bytes
  "storagePath": "path/to/file/in/storage",
  "createdAt": "2023-10-27T10:00:00Z",
  "updatedAt": "2023-10-27T10:00:00Z"
}
```

## 4. RESTful API Endpoints

All endpoints are prefixed with `/api/v1`.

### User Data

- `GET /users/me`: Get the profile of the currently authenticated user.
- `PATCH /users/me`: Update the profile of the currently authenticated user.

### Projects

- `GET /projects`: List all projects for the user.
- `POST /projects`: Create a new project.
- `GET /projects/{projectId}`: Get details of a specific project.
- `PUT /projects/{projectId}`: Update a project.
- `DELETE /projects/{projectId}`: Delete a project.

### Tasks

- `GET /projects/{projectId}/tasks`: List all tasks in a project.
- `POST /projects/{projectId}/tasks`: Create a new task in a project.
- `GET /projects/{projectId}/tasks/{taskId}`: Get details of a specific task.
- `PUT /projects/{projectId}/tasks/{taskId}`: Update a task.
- `DELETE /projects/{projectId}/tasks/{taskId}`: Delete a task.

### Files

- `GET /projects/{projectId}/files`: List all files in a project.
- `POST /projects/{projectId}/files`: Upload a file. The request should be `multipart/form-data`.
- `GET /projects/{projectId}/files/{fileId}`: Get file metadata.
- `GET /projects/{projectId}/files/{fileId}/download`: Download the file content.
- `DELETE /projects/{projectId}/files/{fileId}`: Delete a document.

## 5. Sync API for Offline-First Operations

To support offline-first clients, a sync mechanism is required.

### `GET /sync`

- **Description**: Fetch all changes since the last sync.
- **Query Parameters**: `lastSyncTimestamp` (ISO 8601 string).
- **Response**: Returns a list of created, updated, and deleted entities across all resource types.

  ```json
  {
    "newTimestamp": "2023-10-27T11:00:00Z",
    "changes": {
      "tasks": {
        "created": [...],
        "updated": [...],
        "deleted": ["task_uuid_1", "task_uuid_2"]
      },
      "files": {
        "created": [...],
        "updated": [...],
        "deleted": []
      }
      // ... other resource types
    }
  }
  ```

### `POST /sync`

- **Description**: Push local changes from the client to the server.
- **Request Body**: A batch of local changes.

  ```json
  {
    "changes": {
      "tasks": {
        "created": [...], // full task objects
        "updated": [...] // full task objects
      }
    }
  }
  ```

### Conflict Resolution

- Initially, a "last write wins" strategy will be used, where the `updatedAt` timestamp determines which version to keep.
- For more complex scenarios (e.g., merging text documents), future versions may explore CRDTs (Conflict-free Replicated Data Types).

## 7. Real-time Updates

WebSockets will be used for real-time communication.

1.  Client establishes a WebSocket connection after authentication.
2.  Client subscribes to events for specific resources (e.g., a project).
3.  The server pushes events when data changes.

**Example Events:**

- `task_created`: payload contains the new task object.
- `task_updated`: payload contains the updated task object.
- `document_deleted`: payload contains `{ id: "doc_uuid" }`.

## 8. Rate Limiting and Security

### Rate Limiting

- API endpoints will be rate-limited to prevent abuse. A limit of e.g., 100 requests per minute per user will be enforced.

### Security Considerations

- **HTTPS**: All communication must be over HTTPS.
- **Input Validation**: All incoming data from clients must be validated to prevent XSS, SQL injection, and other attacks.
- **CORS**: Configure Cross-Origin Resource Sharing (CORS) to only allow requests from whitelisted domains (web app, etc.).
- **Data Ownership**: API logic must enforce that users can only access their own data.

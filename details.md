# API Endpoints Documentation

This file documents the API endpoints and Socket.io events defined in `backend/index.js`.
Note: all hashes for file passwords are hashed in sha256 algorithm.

## Express API Endpoints

### 1. GET `/api/level_details`

- **Description**: Retrieve level information including name, points, and completion status.
- **Query Parameters**:
  - `level` (required): The ID of the level.
  - `group` (optional): The group name to check if they have completed the level.
- **Response**: JSON object containing `levelName`, `points`, and `completed` status.

### 2. GET `/api/directory`

- **Description**: Navigate the directory structure and retrieve its contents.
- **Query Parameters**:
  - `level` (required): The ID of the level to load the directory structure from.
  - `path` (optional): The directory path to navigate to.
- **Response**: JSON object representing the directory contents or an error if the path is invalid or points to a file. Files with passwords will be marked as `Protected_file`.

#### Example -

- **Query**: level=dir&path=root%2F
- **Response**:
  ```json
  {
    "dir1": {
      "type": "dir",
      "author": "AMN",
      "creation": "Date_Here",
      "hidden": false
    },
    ".dir2": {
      "type": "dir",
      "author": "AMN",
      "creation": "Date_Here",
      "hidden": false
    },
    "output.txt": {
      "type": "Protected_file"
    },
    "README.txt": {
      "type": "file",
      "author": "SOFTCOM",
      "creation": "12-7-26",
      "hidden": false,
      "content": "Sample file"
    }
  }
  ```

### 3. GET `/api/file`

- **Description**: Retrieve file contents from the directory structure.(Use for protected files)
- **Query Parameters**:
  - `level` (required): The ID of the level.
  - `path` (required): The path of the file to retrieve.
  - `password` (optional): Password hash required for protected files.
- **Response**: JSON object containing the file details or an error message (e.g., if the file doesn't exist, is a directory, or has an incorrect password).

#### Example

- **Query**:level=dir&path=root%2Foutput.txt&password=new-york
- **Response**:

  ```json
  {
    "type": "file",
    "hidden": false,
    "author": "AMN",
    "creation": "Date_Here",
    "content": "This is file 1"
  }
  ```

### 4. GET `/api/points`

- **Description**: Retrieve the current leaderboard (all groups and their points).
- **Response**: JSON object containing key-value pairs of group names and their respective points.

### 5. GET `/admin/login`

- **Description**: Serve the admin login HTML page (`admin_login.html`).
- **Response**: HTML file.

### 6. POST `/admin/clear_points`

- **Description**: Reset all game data (points and groups). Requires an admin password.
- **Body**:
  - `password` (required): The admin password to verify authentication.
- **Response**: JSON object indicating success or a 401 error for incorrect password.

### 7. GET `/*`

- **Description**: Catch-all route for Single Page Application (SPA) routing. Serves `index.html` for unmatched routes.
- **Note**: This endpoint is only active when `NODE_ENV` is set to `"production"`.

---

## Socket.io Events

### Client-to-Server Events

- **`ref_sync`**
  - **Payload**: `{ ref: string }`
  - **Description**: Syncs the client reference with the server's socket ID.

- **`name-set`**
  - **Payload**: `{ ref: string, name: string }`
  - **Description**: Sets the display name for a specific client reference.

- **`create_team`**
  - **Payload**: `{ group: string, ref: string }`
  - **Callback**: Returns success status and team details, or an error if the team already exists.
  - **Description**: Creates a new team with the given group name and assigns the client as the first member.

- **`join_team`**
  - **Payload**: `{ group: string, ref: string }`
  - **Callback**: Returns success status and updated team details, or an error if the team doesn't exist.
  - **Description**: Adds the client to an existing team.

- **`submit_answer`**
  - **Payload**: `{ questionId: string, answer: string, group: string }`
  - **Callback/Emit**: Returns or emits a success/failure message based on answer validation. If correct, updates team points and marks the question as answered for the group.
  - **Description**: Evaluates an answer submitted by a team for a specific question. It automatically broadcasts the updated points globally if the answer is correct.

- **`disconnect`**
  - **Description**: Triggered automatically when a client disconnects. Logs the disconnection.

### Server-to-Client Events

- **`ref_init`**
  - **Payload**: `{ ref: string }`
  - **Description**: Emitted to the client upon initial connection to provide them with a unique reference (socket ID).

- **`answer_result`**
  - **Payload**: `{ success: boolean, message: string }`
  - **Description**: Emitted as a fallback if the client did not provide a callback when submitting an answer.

- **`points`**
  - **Payload**: Object representing all groups and their current points.
  - **Description**: Broadcasted globally to all connected clients whenever a team successfully submits a correct answer and points are updated.

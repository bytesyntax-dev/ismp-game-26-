// Import required modules for the server
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createHash } from "crypto";
import fs from "fs";
import cookieParser from "cookie-parser";
import { table, log } from "console";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loadJson = (relativePath) => JSON.parse(fs.readFileSync(new URL(relativePath, import.meta.url), "utf-8"));
const writeJson = (relativePath, data) => fs.writeFileSync(new URL(relativePath, import.meta.url), JSON.stringify(data, null, 2), "utf-8");
let root, details;

const loadData = (lvl) => {
    root = loadJson("./data/" + (lvl) + ".json");// Load directory structure and question data from JSON files
}
const loadDetails = () => {
    details = loadJson("./data/ans.json");// Load answers and points configuration for quiz questions
}

// Initialize Express app and HTTP server
const app = express();
const server = createServer(app);

app.use(express.json());
app.use(cookieParser());

// Utility function to hash strings using SHA256
const hash = (str) => createHash("sha256").update(str).digest("hex");

// Initialize Socket.io server with CORS settings
const io = new Server(server, {
    cors: {
        origin: "*", // TODO: To be adjusted while deploying in production
        methods: ["GET", "POST"],
    },
});

// Set server port from environment variable or default to 3000
const PORT = process.env.port || 3000;

// Data structures to track game state
const groups = new Map(); // Store team/group information and their members
const refTable = new Map(); // Map client references to socket IDs
let points = {}; // Track points for each group

/*----- Socket.io Connection Handler: Manages real-time game events -----*/
io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Send socket ID to client for reference tracking (client should store in localStorage)
    socket.emit("ref_init", { ref: socket.id });

    // Sync client reference with socket ID when connection is established
    socket.on("ref_sync", (data) => {
        if (data.ref) refTable.set(data.ref, [socket.id, null]);
    });

    socket.on("name-set", (data) => {
        let tmp = refTable.get(data.ref)
        tmp[1] = data.name;
        refTable.set(data.ref, tmp);
    })

    // Handle team creation event
    socket.on("create_team", (data, callback) => {
        const { group, ref } = data;
        // Prevent duplicate team creation
        if (groups.has(group)) {
            return callback({
                success: false,
                error: "team already exists",
            });
        }
        // Create new team with first member
        groups.set(group, { members: [ref] });
        points[group] = 0;
        callback({
            success: true,
            team: {
                name: group,
                members: [{ id: ref, name: refTable.get(ref)?.[1] || "Unknown" }],
            },
        });
    });

    // Handle team join event
    socket.on("join_team", (data, callback) => {
        const { group, ref } = data;
        if (groups.has(group)) {
            // Add member to exist    ing team
            let gp = groups.get(group);
            if (!gp.members.includes(ref)) {
                gp.members.push(ref);
                groups.set(group, gp);
            }
            callback({
                success: true,
                team: {
                    name: group,
                    members: gp.members.map((memberRef) => ({
                        id: memberRef,
                        name: refTable.get(memberRef)?.[1] || "Unknown",
                    })),
                },
            });
        } else {
            // Error if team doesn't exist
            callback({ success: false, error: "couldn't join group" });
        }
    });

    // Handle answer submission event
    socket.on("submit_answer", (data, callback) => {
        const { questionId, answer, group } = data;
        const sendResponse = (payload) => {
            if (typeof callback === 'function') callback(payload);
            else socket.emit("answer_result", payload);
        };

        // Validate: team exists, question exists, answer is correct, and team hasn't answered before
        if (
            groups.has(group) &&
            Object.hasOwn(details, questionId) &&
            details[questionId].answer === answer &&
            !details[questionId].answered_by.includes(group)
        ) {
            // Award points and mark question as answered by this group
            points[group] += details[questionId].points;
            details[questionId].answered_by.push(group);
            details[questionId].points -= 2; // Reduce points for subsequent correct answers to incentivize speed
            sendResponse({
                success: true,
                message: "Correct answer!",
            });
            // Broadcast updated points to all connected clients
            io.emit("points", points);
        } else {
            if (!groups.has(group)) {
                sendResponse({
                    success: false,
                    message: "Your group doesn't exist!",
                });
                return;
            }
            else if (!Object.hasOwn(details, questionId)) {
                sendResponse({
                    success: false,
                    message: "Invalid question ID!",
                });
                return;
            } else if (details[questionId].answered_by.includes(group)) {
                sendResponse({
                    success: false,
                    message: "Your group has already answered this question!",
                });
                return;
            } else {
                sendResponse({
                    success: false,
                    message: "Incorrect answer . Try again!",
                });
            }
        }
    });

    // Handle client disconnect event
    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});

/*----- Express API Endpoints: File system navigation and game data -----*/

/**
 * GET /api/directory
 * Navigate directory structure and list subdirectories/files
 * Query param: path - directory path to navigate
 */
function find_dir(root, path_arr) {
    let r = root;
    for (const p of path_arr) {
        if (p == "" || p == "type" || p == "author" || p == "creation" || p == "hidden" || p == "password" || p == "content") return;
        if (!Object.hasOwn(r, p)) throw new Error("invalid path");
        r = r[p];
    };
    log(r)
    return r;
}

app.get("/api/level_details", (req, res) => {
    const { level,group } = req.query;
    const response={
        levelName: details[level].levelName || `Level ${level}`,
        points: details[level].points || 0,
        completed: group ? details[level].answered_by.includes(group) : details[level].answered_by
    }
    return res.json(response);
})

app.get("/api/directory", (req, res) => {
    const dir = req.query.path?.split(/\/|\\/g).filter(Boolean) ?? [];
    const level = req.query.level;
    if (!fs.existsSync(`./data/levels/${level}.json`)) return res.status(400).json({ error: "Incorrect Level parameter!" });
    loadData(level);
    let response = root;
    try {
        response = find_dir(response, dir);
    } catch (err) {
        log(err)
        return res.status(404).json({ error: "Directory does'nt exist" });
    }

    if (response.type === "file") {
        return res
            .status(400)
            .json({ error: "Path points to a file, not a directory" });
    }

    const output = structuredClone(response);
    for (const [k, v] of Object.entries(response)) {
        const { type, author, creation, hidden, content } = v;
        output[k] = { type, author, creation, hidden, content };
        if (k == "type" || k == "author" || k == "creation" || k == "hidden" || k == "password" || k == "content") delete output[k];
        if (v.password !== undefined) output[k] = { type: "Protected_file" };
    }

    return res.json(output);
});

// 2. Fetch File Contents
app.get("/api/file", (req, res) => {
    const dir = req.query.path?.split(/\/|\\/g).filter(Boolean) ?? [];
    const level = req.query.level;
    if (!fs.existsSync(`./data/levels/${level}.json`)) return res.status(400).json({ error: "Incorrect Level parameter!" });
    loadData(level);
    let file = root;
    try {
        file = find_dir(root, dir);
    } catch {
        return res.status(404).json({ error: "invalid path" });
    }
    table(file)

    if (!file || file.type != "file") {
        return res
            .status(400)
            .json({ error: "Path points to a directory, not a file" });
    }
    if (file?.password !== undefined) {
        const providedPasswordHash = hash(req.query.password ?? "");
        if (file.password !== providedPasswordHash) {
            return res.status(401).json({ error: "Incorrect password" });
        }
    }
    delete file.password; // Remove password hash from response for security
    return res.json(file);
});


/*----- Admin Control Endpoints: Require admin authentication -----*/

/**
 * POST /admin/clear_points
 * Reset all game data (points and groups)
 */

app.get("/admin/login", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/admin_login.html"));
})

app.post("/admin/clear_points", (req, res) => {
    const { password } = req.body;
    // Validate admin password (salted with "admin@IITRPR")
    if (hash(password + "admin@IITRPR") === process.env.ADMIN_PASSWORD) {
        points = {}; // Clear points on successful login
        groups.clear();
        loadDetails(); // Reload question details to reset answered_by arrays
        return res.json({ message: "Points and Groups cleared successfully!", details });
    } else {
        return res.status(401).json({ error: "Incorrect password" });
    }
});

/**
 * GET /api/points
 * Retrieve current leaderboard (all groups and their points)
 */
app.get("/api/points", (req, res) => {
    return res.json(points);
});

/*----- Frontend Hosting -----*/
// In production, serve built frontend files and enable SPA routing
if (process.env.NODE_ENV == "production") {
    // Serve static files from built frontend directory
    app.use(express.static(path.join(__dirname, "../frontend/dist")));

    // Catch-all route for SPA - serve index.html for any unmatched routes
    app.get("/*", (req, res) => {
        res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
    });
}

// Start the server and listen on the configured port
server.listen(PORT, () => {
    console.log("Server running on http://localhost:3000");
});

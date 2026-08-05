import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createHash } from "crypto";
import fs from "fs";
import cookieParser from "cookie-parser";
import { log } from "console";
import path from "path";
import { fileURLToPath } from "url";
import { backup, getBackup } from "./backup.js";
import dotenv from "dotenv";
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const decrement = 2; //Decrement for subsequent submissions

const loadJson = (relativePath) => {
    const data = fs.readFileSync(path.resolve(__dirname, relativePath), "utf-8");
    return JSON.parse(data);
};

let details;
const loadDetails = () => {
    details = getBackup()?.details || loadJson("./data/ans.json"); // Load answers and points config
};
loadDetails();

const app = express();
const server = createServer(app);

app.use(express.json());
app.use(cookieParser());

// Enable CORS for frontend requests (needed when frontend is deployed on Vercel)
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
    res.setHeader("Access-Control-Allow-Headers", "X-Requested-With,content-type,x-player-id");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

const hash = (str) => createHash("sha256").update(str).digest("hex");

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

// Port set to 5000 to prevent conflict with Vite (3000)
const PORT = process.env.PORT || 5000;

const groups = new Map(Object.entries(getBackup()?.groups || {})); // Store team/group states: name -> { members }
const refTable = new Map(); // Map client references to [socketId, name]
let points = getBackup()?.points || {}; // Track team scores
let TIME_START = getBackup()?.TIME_START || null;

const finalTime = (group) => {
    let maxTime = 0;
    if (!points[group]) return 0;
    for (const [k, v] of Object.entries(points[group])) {
        if (k !== "total" && k !== "start" && v && typeof v === 'object' && v.time) {
            maxTime = Math.max(maxTime, v.time);
        }
    }
    return maxTime;
};


const broadcastTeamState = (group) => {
    let payload = {}
    if (groups.has(group)) {
        const gp = groups.get(group);
        const solvedLevels = [1, 2, 3, 4, 5].filter(i => details[getLevelKey(i)]?.answered_by?.includes(group));
        payload.team = {
            name: group,
            code: group,
            members: gp.members.map((memberRef) => ({
                id: memberRef,
                name: refTable.get(memberRef)?.[1] || "Operative",
            })),
        };
        payload.levelData = {
            solvedLevels: solvedLevels,
            startTime: TIME_START,
            score: points[group]?.total || 0,
            serverTime: Date.now()
        }
        //Completed Logic: If the number of solved levels equals the total number of levels, mark as completed
        // Calculate final time if completed, otherwise null
        payload.completed = solvedLevels.length === 5;
        payload.finalTime = payload.completed ? finalTime(group) : null;
    }

    io.to(group).emit("state_sync", payload);
};
// Helper: Recursively convert levels database structure into client-friendly virtual files
function transformFS(node) {
    let result = {};
    if (!node || typeof node !== 'object') return result;

    for (const [name, child] of Object.entries(node)) {
        if (name === "type" || name === "hidden" || name === "author" || name === "creation" || name === "password") {
            continue;
        }

        if (child && typeof child === 'object') {
            if (child.password !== undefined) {
                result[name] = { type: "Protected File" }
            }
            else if (child.content !== undefined) {
                result[name] = child;
            }
            else {
                result[name] = {
                    type: "dir",
                    hidden: child.hidden || false,
                    author: child.author || "Unknown",
                    creation: child.creation || "Unknown",
                    ...transformFS(child)
                };
            }
        }
    }
    return result;
}

// Helper: Map level numbers or names to details answer keys (A-G)
const getLevelKey = (lvl) => {
    if (typeof lvl === 'string' && ["A", "B", "C", "D", "E", "F", "G"].includes(lvl.toUpperCase())) {
        return lvl.toUpperCase();
    }
    const num = parseInt(String(lvl).replace(/\D/g, '')) || 1;
    const keys = ["A", "B", "C", "D", "E", "F", "G"];
    return keys[num - 1] || "A";
};


/*----- Socket.io Connection Handler -----*/
io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // Send connection ref back to client
    socket.emit("ref_init", { ref: socket.id });

    // Sync reference when client sends it
    socket.on("ref_sync", (data) => {
        if (data.ref) {
            const currentRecord = refTable.get(data.ref) || [socket.id, "Operative"];
            currentRecord[0] = socket.id;
            refTable.set(data.ref, currentRecord);
        }
    });

    // Set player's name
    socket.on("name-set", (data) => {
        if (data.ref) {
            const currentRecord = refTable.get(data.ref) || [socket.id, "Operative"];
            currentRecord[1] = data.name || "Operative";
            refTable.set(data.ref, currentRecord);
        }
    });

    // Handle team creation
    socket.on("create_team", (data, callback) => {
        const { group, ref } = data;
        if (groups.has(group)) {
            return callback({
                success: false,
                error: "Team name is already taken.",
            });
        }

        socket.join(group);
        groups.set(group, {
            members: [ref],
        });
        points[group] = { total: 0 }; // Initialize points for the new team

        const playerRecord = refTable.get(ref) || [socket.id, "Operative"];
        callback({
            success: true,
            team: {
                name: group,
                code: group,
                members: [{ id: ref, name: playerRecord[1] }],
            },
        });

        broadcastTeamState(group);
    });

    // Handle team joining
    socket.on("join_team", (data, callback) => {
        if(!groups.has(data.group))return callback({ success: false, error: "Team does not exist." });
        if(groups.get(data.group).length>=3)return callback({ success: false, error: "Team full" });
        const { group, ref } = data;
        if (groups.has(group)) {
            socket.join(group);
            const gp = groups.get(group);
            if (!gp.members.includes(ref)) {
                gp.members.push(ref);
                groups.set(group, gp);
            }

            callback({
                success: true,
                team: {
                    name: group,
                    code: group,
                    members: gp.members.map((memberRef) => ({
                        id: memberRef,
                        name: refTable.get(memberRef)?.[1] || "Operative",
                    })),
                },
            });

            broadcastTeamState(group);
        } else {
            callback({ success: false, error: "Team does not exist." });
        }
    });

    // Handle answer submission
    socket.on("submit_answer", (data, callback) => {
        if(!TIME_START)return callback({ success: false, message: "Cannot submit answers before the game starts." });
        const { questionId, answer, group } = data;
        const time = Date.now() - (TIME_START || -1);
        const sendResponse = (payload) => {
            if (typeof callback === 'function') callback(payload);
            else socket.emit("answer_result", payload);
        };

        if (!groups.has(group)) {
            sendResponse({ success: false, message: "Your team registration is missing." });
            return;
        }

        const levelKey = getLevelKey(questionId);

        if (!Object.hasOwn(details, levelKey)) {
            sendResponse({ success: false, message: "Invalid decryption key or missing level." });
            return;
        }

        if (details[levelKey].answered_by.includes(group)) {
            sendResponse({ success: false, message: "Your team has already solved this level." });
            return;
        }

        if (details[levelKey].answer === answer) {
            const awardPoints = parseInt(details[levelKey].points) || 1000;
            points[group][questionId] = { points: awardPoints, time: time };
            points[group]["total"] = (points[group]["total"] || 0) + awardPoints;
            details[levelKey].points -= decrement;
            details[levelKey].answered_by.push(group);

            sendResponse({ success: true, message: "Correct answer!" });

            // Broadcast scores to all users
            io.emit("points", points);

            // Update and sync team progress
            io.to(group).emit("level_solved", { level: questionId, points: awardPoints });
            broadcastTeamState(group);
        } else {
            sendResponse({ success: false, message: "Incorrect answer. Try again!" });
        }
    });

    // Handle manual level navigation by team members
    socket.on("disconnect", () => {
        for (let [key, val] of refTable.entries()) {
            if (val === socket.id) {
                for (let [grpname, grp] of Object.entries(groups)) {
                    if (grp.members.includes(val)) {
                        let ngp = grp;
                        ngp.members.splice(ngp.members.find((item) => item === val), 1)
                        groups[grpname] = ngp;
                    }
                }
            }
        }
        console.log("User disconnected:", socket.id);
    });
});

/*----- Express API routes -----*/

/**
 * GET /api/level_details
 * Retrieve level information including name, points, and completion status
 * Query params: level - level ID, group (optional) - group name to check if they completed it
 */
app.get("/api/level_details", (req, res) => {
    const { level, group } = req.query;

    // Read the latest names from disk so changes in ans.json are loaded instantly without server restart
    let diskDetails = details;
    try {
        diskDetails = loadJson("./data/ans.json");
    } catch (e) {
        console.error("Error reading ans.json from disk:", e);
    }

    const response = {
        levelName: diskDetails[level]?.levelName || details[level]?.levelName || `Level ${level}`,
        points: details[level]?.points || 0,
        completed: group ? details[level]?.answered_by?.includes(group) : details[level]?.answered_by
    }
    return res.json(response);
})


app.get("/api/directory", (req, res) => {
    const { level, path: queryPath } = req.query;
    try {
        const levelJson = loadJson(`./data/levels/level${level}.json`);
        const virtualFiles = transformFS(levelJson.root);
        return res.json(virtualFiles);
    } catch (err) {
        log(err)
        return res.status(404).json({ error: "Directory structure not found." });
    }
});

app.get("/api/file", (req, res) => {
    const dir = req.query.path?.split(/\/|\\/g).filter(Boolean) ?? [];
    const level = req.query.level;
    if (!fs.existsSync(`./data/levels/level${level}.json`)) return res.status(400).json({ error: "Incorrect Level parameter!" });

    let r = loadJson(`./data/levels/level${level}.json`);
    try {
        for (const p of dir) {
            if (p == "" || p == "type" || p == "author" || p == "creation" || p == "hidden" || p == "password" || p == "content") return;
            if (!Object.hasOwn(r, p)) throw new Error("invalid path");
            r = r[p];
        };
    } catch {
        return res.status(404).json({ error: "invalid path" });
    }
    const file = r;

    if (!file || file.type != "file") {
        return res.json({ error: "Path points to a directory, not a file" });
    }
    if (file?.password !== undefined) {
        const providedPasswordHash = hash(req.query.password ?? "");
        if (file.password !== providedPasswordHash) {
            return res.json({ error: "Incorrect password" });
        }
    }
    delete file.password; // Remove password hash from response for security
    return res.json(file);
});


app.get("/admin/login", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/admin_login.html"));
});

app.post("/admin/clear_points", (req, res) => {
    const { password } = req.body;
    // Allow either the salted environment password or fallback defaults
    const isValidPassword = (password && hash(password + "admin@IITRPR") === process.env.ADMIN_PASSWORD);

    if (isValidPassword) {
        points = {};
        groups.clear();
        backup({});
        loadDetails();
        TIME_START = null

        // Notify all sockets to reset immediately
        io.emit("session_reset");

        return res.json({ message: "Game session and points reset successfully!", details });
    } else {
        return res.status(401).json({ error: "Unauthorized access: incorrect password." });
    }
});

app.get("/api/points", (req, res) => {
    for(const key in points) points[key].start=TIME_START;
    return res.status(200).json(points);
});

app.post("/admin/start_game", (req, res) => {
    const { password } = req.body;
    // Allow either the salted environment password or fallback defaults
    const isValidPassword = (password && (hash(password + "admin@IITRPR") === process.env.ADMIN_PASSWORD));
    if(!isValidPassword) return res.status(401).json({ error: "Unauthorized access: incorrect password." });
    
    TIME_START = Date.now();
    for(const key in points) points[key].start=TIME_START;
    
    // Broadcast the game start event via Socket.io to all clients
    io.emit("game_started", { started: true, time: TIME_START, serverTime: Date.now() });

    return res.status(200).json({ started: true, time: TIME_START });
});

app.get("/api/started", (req, res) => {
    return res.status(200).json({ started: !!TIME_START, time: TIME_START, serverTime: Date.now() });
});

// Production SPA serving
if (process.env.NODE_ENV === "production" || true) {
    app.use(express.static(path.join(__dirname, "../frontend/dist")));
    app.get("/*splat", (req, res) => {
        res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
    });
}

setInterval(() => backup({ details, groups, points, TIME_START }), 1000);

server.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});

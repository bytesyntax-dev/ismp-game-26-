import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createHash } from "crypto";
import fs from "fs";
import cookieParser from "cookie-parser";
import { log } from "console";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const loadJson = (relativePath) => {
    const data = fs.readFileSync(path.resolve(__dirname, relativePath), "utf-8");
    return JSON.parse(data);
};

let details;
const loadDetails = () => {
    details = loadJson("./data/ans.json"); // Load answers and points config
};
loadDetails();

const app = express();
const server = createServer(app);

app.use(express.json());
app.use(cookieParser());

const hash = (str) => createHash("sha256").update(str).digest("hex");

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

// Port set to 5000 to prevent conflict with Vite (3000)
const PORT = process.env.PORT || 5000;

const groups = new Map(); // Store team/group states: name -> { members, currentLevel, startTime }
const refTable = new Map(); // Map client references to [socketId, name]
let points = {}; // Track team scores

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

// Helper: Broadcast synced team state to all members in the socket room
function broadcastTeamState(group) {
    if (!groups.has(group)) return;
    loadDetails();
    const gp = groups.get(group);
    const levelNum = gp.currentLevel || 1;
    const levelKey = getLevelKey(levelNum);

    let virtualFiles = {};
    for (let i = 1; i <= 4; i++) {
        try {
            const levelJson = loadJson(`./data/levels/level${i}.json`);
            virtualFiles[i] = transformFS(levelJson.root);
        } catch (e) {
            console.error(`Error loading level ${i} files:`, e);
        }
    }

    const levelName = details[levelKey]?.levelName || `Level ${levelNum}`;
    const levelCompleted = details[levelKey]?.answered_by?.includes(group) || false;

    // Check if game is completely finished (all 5 levels solved)
    let completedLevelsCount = 0;
    const totalLevels = 5;
    for (let i = 1; i <= totalLevels; i++) {
        const k = getLevelKey(i);
        if (details[k]?.answered_by?.includes(group)) {
            completedLevelsCount++;
        }
    }
    const gameCompleted = completedLevelsCount === totalLevels;
    if (gameCompleted && gp && !gp.finalTime) {
        gp.finalTime = Date.now() - gp.startTime;
        groups.set(group, gp);
    }

    const payload = {
        team: {
            name: group,
            members: gp.members.map(ref => ({
                id: ref,
                name: refTable.get(ref)?.[1] || "Unknown"
            }))
        },
        levelData: {
            level: levelNum,
            score: points[group].total || 0,
            virtualFiles: virtualFiles,
            levelNames: {
                1: details["A"]?.levelName || "Level 1: The Breach",
                2: details["B"]?.levelName || "Level 2: Hidden Channels",
                3: details["C"]?.levelName || "Level 3: Logic Void",
                4: details["D"]?.levelName || "Level 4: Decoder Protocol",
                5: details["E"]?.levelName || "Level 5: Mainframe Override",
            },
            startTime: gp.startTime,
            completed: levelCompleted,
            solvedLevels: [1, 2, 3, 4, 5].filter(i => details[getLevelKey(i)]?.answered_by?.includes(group))
        },
        completed: gameCompleted,
        finalTime: gameCompleted ? gp.finalTime : null
    };

    console.log(`[DEBUG] Emitting state_sync to ${group}. level: ${levelNum}, keys in virtualFiles:`, Object.keys(virtualFiles));
    io.to(group).emit("state_sync", payload);
}

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
            currentLevel: 1,
            startTime: Date.now()
        });
        points[group] = { total: 0 }; // Initialize points for the new team

        const playerRecord = refTable.get(ref) || [socket.id, "Operative"];
        callback({
            success: true,
            team: {
                name: group,
                members: [{ id: ref, name: playerRecord[1] }],
            },
        });

        broadcastTeamState(group);
    });

    // Handle team joining
    socket.on("join_team", (data, callback) => {
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
        const { questionId, answer, group } = data;
        const time = Date.now() - (groups.get(group)?.startTime||-1);
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
            details[levelKey].answered_by.push(group);

            // Automatically advance active level if they solved their current active level
            const gp = groups.get(group);
            if (gp && parseInt(questionId) === gp.currentLevel && gp.currentLevel < 5) {
                gp.currentLevel += 1;
                groups.set(group, gp);
            }

            sendResponse({ success: true, message: "Correct answer!" });

            // Broadcast scores to all users
            io.emit("points", points);

            // Update and sync team progress
            broadcastTeamState(group);
        } else {
            sendResponse({ success: false, message: "Incorrect answer. Try again!" });
        }
    });

    // Handle manual level navigation by team members
    socket.on("select_level", (data) => {
        const { group, level } = data;
        if (groups.has(group)) {
            const gp = groups.get(group);
            gp.currentLevel = parseInt(level) || 1;
            groups.set(group, gp);

            broadcastTeamState(group);
        }
    });

    socket.on("disconnect", () => {
        console.log("User disconnected:", socket.id);
    });
});

/*----- Express API routes -----*/

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
    const { level, path: filePath } = req.query;
    try {
        const levelJson = loadJson(`./data/levels/level${level}.json`);
        const virtualFiles = transformFS(levelJson.root);
        // Simple mock lookup
        const fileKey = filePath?.split('/').pop() || "";
        if (virtualFiles[fileKey]) {
            return res.json(virtualFiles[fileKey]);
        }
        return res.status(404).json({ error: "File not found." });
    } catch {
        return res.status(404).json({ error: "File not found." });
    }
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
        loadDetails();

        // Notify all sockets to reset immediately
        io.emit("session_reset");

        return res.json({ message: "Game session and points reset successfully!", details });
    } else {
        return res.status(401).json({ error: "Unauthorized access: incorrect password." });
    }
});

app.get("/api/points", (req, res) => {
    return res.json(points);
});

// Production SPA serving
if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(__dirname, "../frontend/dist")));
    app.get("/*", (req, res) => {
        res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
    });
}

server.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});


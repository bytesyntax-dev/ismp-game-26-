import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createHash } from "crypto";
import root from "./dir.json" with { type: "json" };
import * as answers from "./ans.json" with { type: "json" };

const app = express();
const server = createServer(app);
const hash = (str) => createHash("sha256").update(str).digest("hex");

const io = new Server(server, {
    cors: {
        origin: "*", // To be adjusted while deploying in production
        methods: ["GET", "POST"],
    },
});
const PORT = process.env.port || 3000;

const groups = new Map();
const refTable = new Map();

const points = {};

// Socket.io connection handler
io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    // client should add this token to local storage if not set
    socket.emit("ref_init", { ref: socket.id });

    // client should use once the connection is established
    socket.on("ref_sync", (data) => {
        if (data.ref) refTable.set(data.ref, socket.id);
    });

    socket.on("create_team", (data) => {
        const { group, ref } = data;
        if (groups.has(group)) {
            return socket.emit("error", {
                success: false,
                message: "team already exists",
            });
        } else {
            groups.set(group, { members: [ref] });
        }
    });

    socket.on("join_team", (data) => {
        const { group, ref } = data;
        if (groups.has(group)) {
            let gp = groups.get(group);
            gp.members.push(ref);
            groups.set(group, gp);
        } else {
            socket.emit("error", { message: "couldn't join group" });
        }
    });

    socket.on("submit_answer", (data) => {
        const { questionId, answer, group } = data;
        if (
            Object.hasOwn(answers, questionId) &&
            answers[questionId].answer === answer &&
            !answers[questionId].answered_by.includes(group)
        ) {
            points[group] += answers[questionId].points;
            answers[questionId].answered_by.push(group);
            answers[questionId].points -= 2; // Reduce points for subsequent correct answers
            socket.emit("answer_result", {
                success: true,
                message: "Correct answer!",
            });
            io.emit("points", points);
        } else {
            if (!Object.hasOwn(answers, questionId)) {
                socket.emit("answer_result", {
                    success: false,
                    message: "Invalid question ID!",
                });
                return;
            } else if (answers[questionId].answered_by.includes(group)) {
                socket.emit("answer_result", {
                    success: false,
                    message: "Your group has already answered this question!",
                });
                return;
            } else
                socket.emit("answer_result", {
                    success: false,
                    message: "Incorrect answer . Try again!",
                });
        }
    });

    socket.on("disconnect", () => {
        console.log("User disconnected");
    });
});

//--------------------------------- [ BACKEND EXPRESS ENDPOINTS ] ---------------------------------------------

function find_dir(root, path_arr) {
    let r = root;
    path_arr.forEach((p) => {
        r = r[p];
    });
    return r;
}

app.get("/api/directory", (req, res) => {
    const dir = req.query.path?.split(/\/|\\/g).filter(Boolean) ?? [];
    let response = root;
    try {
        response = find_dir(response, dir);
    } catch {
        return res.status(404).json({ error: "Directory does'nt exist" });
    }

    if (response.type === "file") {
        return res
            .status(400)
            .json({ error: "Path points to a file, not a directory" });
    }

    const output = structuredClone(response);
    for (const [k, v] of Object.entries(response)) {
        const { type, author, creation, hidden } = v;
        output[k] = { type, author, creation, hidden };
    }

    return res.json(output);
});

// 2. Fetch File Contents
app.get("/api/file", (req, res) => {
    const dir = req.query.file_path?.split(/\/|\\/g).filter(Boolean) ?? [];

    let response = root;
    try {
        let file = find_dir(root, dir);
    } catch {
        return res.status(404).json({ error: "invalid path" });
    }

    if (!response || response.type != "file") {
        return res
            .status(400)
            .json({ error: "Path points to a directory, not a file" });
    }
    if (response?.password !== undefined) {
        const providedPasswordHash = hash(req.query.password ?? "");
        if (response.password !== providedPasswordHash) {
            return res.status(401).json({ error: "Incorrect password" });
        }
    }

    return res.json(response);
});

app.post("/api/register_group", (req, res) => {
    const { group_name } = req.body;
    if (Object.hasOwn(points, group_name)) {
        return res.status(400).json({ error: "Group name already exists!" });
    }
    points[group_name] = 0;
    return res.json({ message: "Group registered successfully!" });
});

//Host frontend on the same server
if (process.env.NODE_ENV == "production") {
    app.use(express.static(path.join(__dirname, "../frontend/dist")));

    app.get("*", (req, res) => {
        res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
    });
}

// Start the server
server.listen(PORT, () => {
    console.log("Server running on http://localhost:3000");
});

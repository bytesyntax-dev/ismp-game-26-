import fs from 'fs'
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backupFile='./backup.json'

const backup = (data) => {
    fs.writeFileSync(path.resolve(__dirname, backupFile), JSON.stringify(data));
}

const getBackup = () => {
    try {
        const data = fs.readFileSync(path.resolve(__dirname, backupFile), "utf-8");
        return JSON.parse(data);
    }
    catch (error) { return {} }
}

export { backup, getBackup }

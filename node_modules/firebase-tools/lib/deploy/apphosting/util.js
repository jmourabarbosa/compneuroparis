"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createArchive = createArchive;
const archiver = require("archiver");
const fs = require("fs");
const path = require("path");
const tmp = require("tmp");
const error_1 = require("../../error");
const fsAsync = require("../../fsAsync");
async function createArchive(config, rootDir, targetSubDir) {
    const tmpFile = tmp.fileSync({ prefix: `${config.backendId}-`, postfix: ".zip" }).name;
    const fileStream = fs.createWriteStream(tmpFile, {
        flags: "w",
        encoding: "binary",
    });
    const archive = archiver("zip");
    const targetDir = targetSubDir ? path.join(rootDir, targetSubDir) : rootDir;
    const ignore = config.ignore || ["node_modules", ".git"];
    ignore.push("firebase-debug.log", "firebase-debug.*.log");
    const gitIgnorePatterns = parseGitIgnorePatterns(targetDir);
    ignore.push(...gitIgnorePatterns);
    try {
        const files = await fsAsync.readdirRecursive({
            path: targetDir,
            ignore: ignore,
            isGitIgnore: true,
        });
        for (const file of files) {
            const name = path.relative(rootDir, file.name);
            archive.file(file.name, {
                name,
                mode: file.mode,
            });
        }
        await pipeAsync(archive, fileStream);
    }
    catch (err) {
        throw new error_1.FirebaseError("Could not read source directory. Remove links and shortcuts and try again.", { original: err, exit: 1 });
    }
    return tmpFile;
}
function parseGitIgnorePatterns(projectRoot, gitIgnorePath = ".gitignore") {
    const absoluteFilePath = path.resolve(projectRoot, gitIgnorePath);
    if (!fs.existsSync(absoluteFilePath)) {
        return [];
    }
    const lines = fs
        .readFileSync(absoluteFilePath)
        .toString()
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => !line.startsWith("#") && !(line === ""));
    return lines;
}
async function pipeAsync(from, to) {
    from.pipe(to);
    await from.finalize();
    return new Promise((resolve, reject) => {
        to.on("finish", resolve);
        to.on("error", reject);
    });
}

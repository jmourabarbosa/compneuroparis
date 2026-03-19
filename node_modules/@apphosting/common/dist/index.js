"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateOrCreateGitignore = exports.getBuildOptions = exports.runBuild = exports.DEFAULT_COMMAND = exports.Availability = void 0;
const child_process_1 = require("child_process");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
// Represents where environment variables are made available
var Availability;
(function (Availability) {
    // Runtime environment variables are available on the server when the app is run
    Availability["Runtime"] = "RUNTIME";
    Availability["Build"] = "BUILD";
})(Availability || (exports.Availability = Availability = {}));
exports.DEFAULT_COMMAND = "npm";
// Run the build command in a spawned child process.
// By default, "npm run build" will be used, or in monorepo cases,
// the monorepo build command (e.g. "nx build").
async function runBuild(opts = getBuildOptions()) {
    return new Promise((resolve, reject) => {
        const child = (0, child_process_1.spawn)(opts.buildCommand, [...opts.buildArgs], {
            cwd: process.cwd(),
            shell: true,
            stdio: ["inherit", "pipe", "pipe"],
        });
        let stdout = "";
        let stderr = "";
        child.stdout.on("data", (data) => {
            stdout += data.toString();
        });
        child.stderr.on("data", (data) => {
            stderr += data.toString();
        });
        // Re-connect the child process's stdout and stderr to the console so that
        // build messages and errors are still logged in Cloud Build.
        child.stdout.pipe(process.stdout);
        child.stderr.pipe(process.stderr);
        child.on("exit", (code) => {
            if (code !== 0) {
                reject(new Error(`Build process exited with error code ${code}.`));
            }
            resolve({ stdout: stdout, stderr: stderr });
        });
    });
}
exports.runBuild = runBuild;
// Get a set of default options, derived from the environment variable API
// passed down to the adapter from the buildpacks environment.
function getBuildOptions() {
    if (process.env.MONOREPO_COMMAND) {
        return {
            buildCommand: process.env.MONOREPO_COMMAND,
            buildArgs: ["run", "build"].concat(process.env.MONOREPO_BUILD_ARGS?.split(",") || []),
            projectDirectory: process.env.GOOGLE_BUILDABLE || "",
            projectName: process.env.MONOREPO_PROJECT,
        };
    }
    return {
        buildCommand: exports.DEFAULT_COMMAND,
        buildArgs: ["run", "build"],
        projectDirectory: process.cwd(),
    };
}
exports.getBuildOptions = getBuildOptions;
/**
 * Updates or creates a .gitignore file with the given entries in the given path
 */
function updateOrCreateGitignore(dirPath, entries) {
    const gitignorePath = path.join(dirPath, ".gitignore");
    if (!fs.existsSync(gitignorePath)) {
        console.log(`creating ${gitignorePath} with entries: ${entries.join("\n")}`);
        fs.writeFileSync(gitignorePath, entries.join("\n"));
        return;
    }
    let content = fs.readFileSync(gitignorePath, "utf-8");
    for (const entry of entries) {
        if (!content.split("\n").includes(entry)) {
            console.log(`adding ${entry} to ${gitignorePath}`);
            content += `\n${entry}`;
        }
    }
    fs.writeFileSync(gitignorePath, content);
}
exports.updateOrCreateGitignore = updateOrCreateGitignore;

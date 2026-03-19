"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFirebaseStudio = isFirebaseStudio;
exports.isFirebaseMcp = isFirebaseMcp;
exports.detectAIAgent = detectAIAgent;
const fsutils_1 = require("./fsutils");
let googleIdxFolderExists;
function isFirebaseStudio() {
    if (googleIdxFolderExists === true || process.env.MONOSPACE_ENV)
        return true;
    if (googleIdxFolderExists === false)
        return false;
    googleIdxFolderExists = (0, fsutils_1.dirExistsSync)("/google/idx");
    return googleIdxFolderExists;
}
function isFirebaseMcp() {
    return !!process.env.IS_FIREBASE_MCP;
}
function detectAIAgent() {
    if (process.env.ANTIGRAVITY_CLI_ALIAS)
        return "antigravity";
    if (process.env.CLAUDECODE)
        return "claude_code";
    if (process.env.CLINE_ACTIVE)
        return "cline";
    if (process.env.CODEX_SANDBOX)
        return "codex_cli";
    if (process.env.CURSOR_AGENT)
        return "cursor";
    if (process.env.GEMINI_CLI)
        return "gemini_cli";
    if (process.env.OPENCODE)
        return "open_code";
    return "unknown";
}

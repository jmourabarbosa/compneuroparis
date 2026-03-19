#! /usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("../index.js");
const commander_1 = require("commander");
commander_1.program
    .argument("<projectRoot>", "path to the project's root directory")
    .option("--framework <framework>")
    .action(async (projectRoot, opts) => {
    await (0, index_js_1.localBuild)(projectRoot, opts.framework);
});
commander_1.program.parse();

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.localBuild = localBuild;
const build_1 = require("@apphosting/build");
async function localBuild(projectRoot, framework) {
    const apphostingBuildOutput = await (0, build_1.localBuild)(projectRoot, framework);
    const annotations = Object.fromEntries(Object.entries(apphostingBuildOutput.metadata).map(([key, value]) => [key, String(value)]));
    const env = apphostingBuildOutput.runConfig.environmentVariables?.map(({ variable, value, availability }) => ({
        variable,
        value,
        availability,
    }));
    return {
        outputFiles: apphostingBuildOutput.outputFiles?.serverApp.include ?? [],
        annotations,
        buildConfig: {
            runCommand: apphostingBuildOutput.runConfig.runCommand,
            env: env ?? [],
        },
    };
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const ora = require("ora");
const api_1 = require("../../api");
const backend_1 = require("../../apphosting/backend");
const rollout_1 = require("../../apphosting/rollout");
const projectUtils_1 = require("../../projectUtils");
const utils_1 = require("../../utils");
async function default_1(context, options) {
    let backendIds = Object.keys(context.backendConfigs);
    const missingBackends = backendIds.filter((id) => !context.backendLocations[id] || !context.backendStorageUris[id]);
    if (missingBackends.length > 0) {
        (0, utils_1.logLabeledWarning)("apphosting", `Failed to find metadata for backend(s) ${backendIds.join(", ")}. Please contact support with the contents of your firebase-debug.log to report your issue.`);
        backendIds = backendIds.filter((id) => !missingBackends.includes(id));
    }
    const localBuildBackends = backendIds.filter((id) => context.backendLocalBuilds[id]);
    if (localBuildBackends.length > 0) {
        (0, utils_1.logLabeledWarning)("apphosting", `Skipping backend(s) ${localBuildBackends.join(", ")}. Local Builds are not supported yet.`);
        backendIds = backendIds.filter((id) => !localBuildBackends.includes(id));
    }
    if (backendIds.length === 0) {
        return;
    }
    const projectId = (0, projectUtils_1.needProjectId)(options);
    const rollouts = backendIds.map((backendId) => (0, rollout_1.orchestrateRollout)({
        projectId,
        backendId,
        location: context.backendLocations[backendId],
        buildInput: {
            source: {
                archive: {
                    userStorageUri: context.backendStorageUris[backendId],
                    rootDirectory: context.backendConfigs[backendId].rootDir,
                },
            },
        },
    }));
    (0, utils_1.logLabeledBullet)("apphosting", `You may also track the rollout(s) at:\n\t${(0, api_1.consoleOrigin)()}/project/${projectId}/apphosting`);
    const rolloutsSpinner = ora(`Starting rollout(s) for backend(s) ${backendIds.join(", ")}; this may take a few minutes. It's safe to exit now.\n`).start();
    const results = await Promise.allSettled(rollouts);
    for (let i = 0; i < results.length; i++) {
        const res = results[i];
        if (res.status === "fulfilled") {
            const backend = await (0, backend_1.getBackend)(projectId, backendIds[i]);
            (0, utils_1.logLabeledSuccess)("apphosting", `Rollout for backend ${backendIds[i]} complete!`);
            (0, utils_1.logLabeledSuccess)("apphosting", `Your backend is now deployed at:\n\thttps://${backend.uri}`);
        }
        else {
            (0, utils_1.logLabeledWarning)("apphosting", `Rollout for backend ${backendIds[i]} failed.`);
            (0, utils_1.logLabeledError)("apphosting", res.reason);
        }
    }
    rolloutsSpinner.stop();
}

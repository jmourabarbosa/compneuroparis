"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
exports.getBackendConfigs = getBackendConfigs;
const path = require("path");
const backend_1 = require("../../apphosting/backend");
const apphosting_1 = require("../../gcp/apphosting");
const devConnect_1 = require("../../gcp/devConnect");
const projectUtils_1 = require("../../projectUtils");
const prompt_1 = require("../../prompt");
const utils_1 = require("../../utils");
const localbuilds_1 = require("../../apphosting/localbuilds");
const error_1 = require("../../error");
async function default_1(context, options) {
    const projectId = (0, projectUtils_1.needProjectId)(options);
    await (0, apphosting_1.ensureApiEnabled)(options);
    await (0, backend_1.ensureRequiredApisEnabled)(projectId);
    await (0, backend_1.ensureAppHostingComputeServiceAccount)(projectId, "");
    context.backendConfigs = {};
    context.backendLocations = {};
    context.backendStorageUris = {};
    context.backendLocalBuilds = {};
    const configs = getBackendConfigs(options);
    const { backends } = await (0, apphosting_1.listBackends)(projectId, "-");
    const foundBackends = [];
    const notFoundBackends = [];
    const ambiguousBackends = [];
    const skippedBackends = [];
    for (const cfg of configs) {
        const filteredBackends = backends.filter((backend) => (0, apphosting_1.parseBackendName)(backend.name).id === cfg.backendId);
        if (filteredBackends.length === 0) {
            notFoundBackends.push(cfg);
        }
        else if (filteredBackends.length === 1) {
            foundBackends.push(cfg);
        }
        else {
            ambiguousBackends.push(cfg);
        }
    }
    for (const cfg of ambiguousBackends) {
        const filteredBackends = backends.filter((backend) => (0, apphosting_1.parseBackendName)(backend.name).id === cfg.backendId);
        const locations = filteredBackends.map((b) => (0, apphosting_1.parseBackendName)(b.name).location);
        (0, utils_1.logLabeledWarning)("apphosting", `You have multiple backends with the same ${cfg.backendId} ID in regions: ${locations.join(", ")}. This is not allowed until we can support more locations. ` +
            "Please delete and recreate any backends that share an ID with another backend.");
    }
    if (foundBackends.length > 0) {
        (0, utils_1.logLabeledBullet)("apphosting", `Found backend(s) ${foundBackends.map((cfg) => cfg.backendId).join(", ")}`);
    }
    for (const cfg of foundBackends) {
        const filteredBackends = backends.filter((backend) => (0, apphosting_1.parseBackendName)(backend.name).id === cfg.backendId);
        if (cfg.alwaysDeployFromSource === false) {
            skippedBackends.push(cfg);
            continue;
        }
        const backend = filteredBackends[0];
        const { location } = (0, apphosting_1.parseBackendName)(backend.name);
        if (cfg.alwaysDeployFromSource === undefined && backend.codebase?.repository) {
            const { connectionName, id } = (0, devConnect_1.parseGitRepositoryLinkName)(backend.codebase.repository);
            const gitRepositoryLink = await (0, devConnect_1.getGitRepositoryLink)(projectId, location, connectionName, id);
            if (!options.force) {
                const confirmDeploy = await (0, prompt_1.confirm)({
                    default: true,
                    message: `${cfg.backendId} is linked to the remote repository at ${gitRepositoryLink.cloneUri}. Are you sure you want to deploy your local source?`,
                });
                cfg.alwaysDeployFromSource = confirmDeploy;
                const configPath = path.join(options.projectRoot || "", "firebase.json");
                options.config.writeProjectFile(configPath, options.config.src);
                (0, utils_1.logLabeledBullet)("apphosting", `On future invocations of "firebase deploy", your local source will ${!confirmDeploy ? "not " : ""}be deployed to ${cfg.backendId}. You can edit this setting in your firebase.json at any time.`);
                if (!confirmDeploy) {
                    skippedBackends.push(cfg);
                    continue;
                }
            }
        }
        context.backendConfigs[cfg.backendId] = cfg;
        context.backendLocations[cfg.backendId] = location;
    }
    if (notFoundBackends.length > 0) {
        if (options.force) {
            (0, utils_1.logLabeledWarning)("apphosting", `Skipping deployments of backend(s) ${notFoundBackends.map((cfg) => cfg.backendId).join(", ")}; ` +
                "the backend(s) do not exist yet and we cannot create them for you because you must choose primary regions for each one. " +
                "Please run 'firebase deploy' without the --force flag, or 'firebase apphosting:backends:create' to create the backend, " +
                "then retry deployment.");
            return;
        }
        const confirmCreate = await (0, prompt_1.confirm)({
            default: true,
            message: `Did not find backend(s) ${notFoundBackends.map((cfg) => cfg.backendId).join(", ")}. Do you want to create them (you'll have the option to select which to create in the next step)?`,
        });
        if (confirmCreate) {
            const selected = await (0, prompt_1.checkbox)({
                message: "Which backends do you want to create and deploy to?",
                choices: notFoundBackends.map((cfg) => cfg.backendId),
            });
            const selectedBackends = selected.map((id) => notFoundBackends.find((backend) => backend.backendId === id));
            for (const cfg of selectedBackends) {
                (0, utils_1.logLabeledBullet)("apphosting", `Creating a new backend ${cfg.backendId}...`);
                const { location } = await (0, backend_1.doSetupSourceDeploy)(projectId, cfg.backendId);
                context.backendConfigs[cfg.backendId] = cfg;
                context.backendLocations[cfg.backendId] = location;
            }
        }
        else {
            skippedBackends.push(...notFoundBackends);
        }
    }
    if (skippedBackends.length > 0) {
        (0, utils_1.logLabeledWarning)("apphosting", `Skipping deployment of backend(s) ${skippedBackends.map((cfg) => cfg.backendId).join(", ")}.`);
    }
    for (const cfg of Object.values(context.backendConfigs)) {
        if (!cfg.localBuild) {
            continue;
        }
        (0, utils_1.logLabeledBullet)("apphosting", `Starting local build for backend ${cfg.backendId}`);
        try {
            const { outputFiles, annotations, buildConfig } = await (0, localbuilds_1.localBuild)(options.projectRoot || "./", "nextjs");
            if (outputFiles.length !== 1) {
                throw new error_1.FirebaseError(`Local build for backend ${cfg.backendId} failed: No output files found.`);
            }
            context.backendLocalBuilds[cfg.backendId] = {
                buildDir: outputFiles[0],
                buildConfig,
                annotations,
            };
        }
        catch (e) {
            throw new error_1.FirebaseError(`Local Build for backend ${cfg.backendId} failed: ${e}`);
        }
    }
}
function getBackendConfigs(options) {
    if (!options.config.src.apphosting) {
        return [];
    }
    const backendConfigs = Array.isArray(options.config.src.apphosting)
        ? options.config.src.apphosting
        : [options.config.src.apphosting];
    if (!options.only) {
        return backendConfigs;
    }
    const selectors = options.only.split(",");
    const backendIds = [];
    for (const selector of selectors) {
        if (selector === "apphosting") {
            return backendConfigs;
        }
        if (selector.startsWith("apphosting:")) {
            const backendId = selector.replace("apphosting:", "");
            if (backendId.length > 0) {
                backendIds.push(backendId);
            }
        }
    }
    if (backendIds.length === 0) {
        return [];
    }
    return backendConfigs.filter((cfg) => backendIds.includes(cfg.backendId));
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
const fs = require("fs");
const path = require("path");
const error_1 = require("../../error");
const gcs = require("../../gcp/storage");
const getProjectNumber_1 = require("../../getProjectNumber");
const projectUtils_1 = require("../../projectUtils");
const utils_1 = require("../../utils");
const util_1 = require("./util");
async function default_1(context, options) {
    if (Object.entries(context.backendConfigs).length === 0) {
        return;
    }
    const projectId = (0, projectUtils_1.needProjectId)(options);
    options.projectNumber = await (0, getProjectNumber_1.getProjectNumber)(options);
    if (!context.backendConfigs) {
        return;
    }
    const bucketsPerLocation = {};
    await Promise.all(Object.entries(context.backendLocations).map(async ([backendId, loc]) => {
        const cfg = context.backendConfigs[backendId];
        if (!cfg) {
            throw new error_1.FirebaseError(`Failed to find config for backend ${backendId}. Please contact support with the contents of your firebase-debug.log to report your issue.`);
        }
        const baseName = `firebaseapphosting-sources-${options.projectNumber}-${loc.toLowerCase()}`;
        const resolvedName = await gcs.upsertBucket({
            product: "apphosting",
            createMessage: `Creating Cloud Storage bucket in ${loc} to store App Hosting source code uploads at ${baseName}...`,
            projectId,
            req: {
                baseName,
                purposeLabel: `apphosting-source-${loc.toLowerCase()}`,
                location: loc,
                lifecycle: {
                    rule: [
                        {
                            action: {
                                type: "Delete",
                            },
                            condition: {
                                age: 30,
                            },
                        },
                    ],
                },
            },
        });
        bucketsPerLocation[loc] = resolvedName;
    }));
    await Promise.all(Object.values(context.backendConfigs).map(async (cfg) => {
        const rootDir = options.projectRoot ?? process.cwd();
        let builtAppDir;
        if (cfg.localBuild) {
            builtAppDir = context.backendLocalBuilds[cfg.backendId].buildDir;
            if (!builtAppDir) {
                throw new error_1.FirebaseError(`No local build dir found for ${cfg.backendId}`);
            }
        }
        const zippedSourcePath = await (0, util_1.createArchive)(cfg, rootDir, builtAppDir);
        (0, utils_1.logLabeledBullet)("apphosting", `Zipped ${cfg.localBuild ? "built app" : "source"} for backend ${cfg.backendId}`);
        const backendLocation = context.backendLocations[cfg.backendId];
        if (!backendLocation) {
            throw new error_1.FirebaseError(`Failed to find location for backend ${cfg.backendId}. Please contact support with the contents of your firebase-debug.log to report your issue.`);
        }
        (0, utils_1.logLabeledBullet)("apphosting", `Uploading ${cfg.localBuild ? "built app" : "source"} for backend ${cfg.backendId}...`);
        const bucketName = bucketsPerLocation[backendLocation];
        const { bucket, object } = await gcs.uploadObject({
            file: zippedSourcePath,
            stream: fs.createReadStream(zippedSourcePath),
        }, bucketName);
        (0, utils_1.logLabeledBullet)("apphosting", `Uploaded at gs://${bucket}/${object}`);
        context.backendStorageUris[cfg.backendId] =
            `gs://${bucketName}/${path.basename(zippedSourcePath)}`;
    }));
}

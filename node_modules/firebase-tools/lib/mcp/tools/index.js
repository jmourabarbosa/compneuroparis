"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getToolsByFeature = getToolsByFeature;
exports.availableTools = availableTools;
exports.markdownDocsOfTools = markdownDocsOfTools;
const index_1 = require("./apphosting/index");
const index_2 = require("./apptesting/index");
const index_3 = require("./auth/index");
const index_4 = require("./core/index");
const index_5 = require("./crashlytics/index");
const index_6 = require("./dataconnect/index");
const index_7 = require("./firestore/index");
const index_8 = require("./functions/index");
const index_9 = require("./messaging/index");
const index_10 = require("./realtime_database/index");
const index_11 = require("./remoteconfig/index");
const index_12 = require("./storage/index");
function addFeaturePrefix(feature, tools) {
    return tools.map((tool) => ({
        ...tool,
        mcp: {
            ...tool.mcp,
            name: `${feature}_${tool.mcp.name}`,
            _meta: {
                ...tool.mcp._meta,
                feature,
            },
        },
    }));
}
const tools = {
    apphosting: addFeaturePrefix("apphosting", index_1.appHostingTools),
    apptesting: addFeaturePrefix("apptesting", index_2.apptestingTools),
    auth: addFeaturePrefix("auth", index_3.authTools),
    core: addFeaturePrefix("firebase", index_4.coreTools),
    crashlytics: addFeaturePrefix("crashlytics", index_5.crashlyticsTools),
    database: addFeaturePrefix("realtimedatabase", index_10.realtimeDatabaseTools),
    dataconnect: addFeaturePrefix("dataconnect", index_6.dataconnectTools),
    firestore: addFeaturePrefix("firestore", index_7.firestoreTools),
    functions: addFeaturePrefix("functions", index_8.functionsTools),
    messaging: addFeaturePrefix("messaging", index_9.messagingTools),
    remoteconfig: addFeaturePrefix("remoteconfig", index_11.remoteConfigTools),
    storage: addFeaturePrefix("storage", index_12.storageTools),
};
const allToolsMap = new Map(Object.values(tools)
    .flat()
    .sort((a, b) => a.mcp.name.localeCompare(b.mcp.name))
    .map((t) => [t.mcp.name, t]));
function getToolsByName(names) {
    const selectedTools = new Set();
    for (const toolName of names) {
        const tool = allToolsMap.get(toolName);
        if (tool) {
            selectedTools.add(tool);
        }
    }
    return Array.from(selectedTools);
}
function getToolsByFeature(serverFeatures) {
    const features = new Set(serverFeatures?.length ? serverFeatures : Object.keys(tools));
    features.add("core");
    return Array.from(features).flatMap((feature) => tools[feature] || []);
}
async function availableTools(ctx, activeFeatures, detectedFeatures, enabledTools) {
    if (enabledTools?.length) {
        return getToolsByName(enabledTools);
    }
    if (activeFeatures?.length) {
        return getToolsByFeature(activeFeatures);
    }
    const allTools = getToolsByFeature(detectedFeatures);
    const availabilities = await Promise.all(allTools.map((t) => {
        if (t.isAvailable) {
            return t.isAvailable(ctx);
        }
        return true;
    }));
    return allTools.filter((_, i) => availabilities[i]);
}
function markdownDocsOfTools() {
    const allTools = getToolsByFeature([]);
    let doc = `
| Tool Name | Feature Group | Description |
| --------- | ------------- | ----------- |`;
    for (const tool of allTools) {
        let feature = tool.mcp?._meta?.feature || "";
        if (feature === "firebase") {
            feature = "core";
        }
        const description = (tool.mcp?.description || "").replaceAll("\n", "<br>");
        doc += `
| ${tool.mcp.name} | ${feature} | ${description} |`;
    }
    return doc;
}

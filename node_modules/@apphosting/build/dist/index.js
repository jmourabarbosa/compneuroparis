"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.localBuild = localBuild;
exports.adapterBuild = adapterBuild;
const promise_spawn_1 = __importDefault(require("@npmcli/promise-spawn"));
const fs_1 = require("fs");
const path_1 = require("path");
const colorette_1 = require("colorette");
const common_1 = require("@apphosting/common");
const yaml_1 = require("yaml");
async function localBuild(projectRoot, framework) {
    if (framework && common_1.SupportedFrameworks.includes(framework)) {
        // TODO(#382): Skip this if there's a custom build command in apphosting.yaml.
        await adapterBuild(projectRoot, framework);
        const bundleYamlPath = (0, path_1.join)(projectRoot, ".apphosting", "bundle.yaml");
        if (!(0, fs_1.existsSync)(bundleYamlPath)) {
            throw new Error(`Cannot load ${bundleYamlPath} from given path, it doesn't exist`);
        }
        return (0, yaml_1.parse)((0, fs_1.readFileSync)(bundleYamlPath, "utf8"));
    }
    throw new Error("framework not supported");
}
async function adapterBuild(projectRoot, framework) {
    // TODO(#382): support other apphosting.*.yaml files.
    // TODO(#382): parse apphosting.yaml for environment variables / secrets needed during build time.
    // TODO(#382): We are using the latest framework adapter versions, but in the future
    // we should parse the framework version and use the matching adapter version.
    const adapterName = `@apphosting/adapter-${framework}`;
    const packumentResponse = await fetch(`https://registry.npmjs.org/${adapterName}`);
    if (!packumentResponse.ok)
        throw new Error(`Failed to fetch ${adapterName}: ${packumentResponse.status} ${packumentResponse.statusText}`);
    let packument;
    try {
        packument = await packumentResponse.json();
    }
    catch (e) {
        throw new Error(`Failed to parse response from NPM registry for ${adapterName}.`);
    }
    const adapterVersion = packument?.["dist-tags"]?.["latest"];
    if (!adapterVersion) {
        throw new Error(`Could not find 'latest' dist-tag for ${adapterName}`);
    }
    // TODO(#382): should check for existence of adapter in app's package.json and use that version instead.
    console.log(" 🔥", (0, colorette_1.bgRed)(` ${adapterName}@${(0, colorette_1.yellow)((0, colorette_1.bold)(adapterVersion))} `), "\n");
    const buildCommand = `apphosting-adapter-${framework}-build`;
    await (0, promise_spawn_1.default)("npx", ["-y", "-p", `${adapterName}@${adapterVersion}`, buildCommand], {
        cwd: projectRoot,
        shell: true,
        stdio: "inherit",
    });
    const bundleYamlPath = (0, path_1.join)(projectRoot, ".apphosting", "bundle.yaml");
    if (!(0, fs_1.existsSync)(bundleYamlPath)) {
        throw new Error(`Cannot load ${bundleYamlPath} from given path, it doesn't exist`);
    }
    return (0, yaml_1.parse)((0, fs_1.readFileSync)(bundleYamlPath, "utf8"));
    // TODO(#382): Parse apphosting.yaml to set custom run command in bundle.yaml
    // TODO(#382): parse apphosting.yaml for runConfig to include in bundle.yaml
    // TODO(#382): parse apphosting.yaml for environment variables / secrets needed during runtime to include in the bundle.yaml
}

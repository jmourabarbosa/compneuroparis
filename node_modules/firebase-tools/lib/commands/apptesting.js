"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.command = void 0;
const requireAuth_1 = require("../requireAuth");
const command_1 = require("../command");
const logger_1 = require("../logger");
const clc = require("colorette");
const parseTestFiles_1 = require("../apptesting/parseTestFiles");
const ora = require("ora");
const error_1 = require("../error");
const marked_1 = require("marked");
const client_1 = require("../appdistribution/client");
const distribution_1 = require("../appdistribution/distribution");
const options_parser_util_1 = require("../appdistribution/options-parser-util");
const defaultDevices = [
    {
        model: "MediumPhone.arm",
        version: "36",
        locale: "en_US",
        orientation: "portrait",
    },
];
exports.command = new command_1.Command("apptesting:execute <release-binary-file>")
    .description("Run mobile automated tests written in natural language driven by AI")
    .option("--app <app_id>", "The app id of your Firebase web app. Optional if the project contains exactly one web app.")
    .option("--test-file-pattern <pattern>", "Test file pattern. Only tests contained in files that match this pattern will be executed.")
    .option("--test-name-pattern <pattern>", "Test name pattern. Only tests with names that match this pattern will be executed.")
    .option("--test-dir <test_dir>", "Directory where tests can be found.")
    .option("--test-devices <string>", "semicolon-separated list of devices to run automated tests on, in the format 'model=<model-id>,version=<os-version-id>,locale=<locale>,orientation=<orientation>'. Run 'gcloud firebase test android|ios models list' to see available devices. Note: This feature is in beta.")
    .option("--test-devices-file <string>", "path to file containing a list of semicolon- or newline-separated devices to run automated tests on, in the format 'model=<model-id>,version=<os-version-id>,locale=<locale>,orientation=<orientation>'. Run 'gcloud firebase test android|ios models list' to see available devices. Note: This feature is in beta.")
    .before(requireAuth_1.requireAuth)
    .action(async (target, options) => {
    const appName = (0, options_parser_util_1.getAppName)(options);
    const testDir = options.testDir || "tests";
    const tests = await (0, parseTestFiles_1.parseTestFiles)(testDir, undefined, options.testFilePattern, options.testNamePattern);
    const testDevices = (0, options_parser_util_1.parseTestDevices)(options.testDevices, options.testDevicesFile);
    if (!tests.length) {
        throw new error_1.FirebaseError("No tests found");
    }
    const invokeSpinner = ora("Requesting test execution");
    let testInvocations;
    let releaseId;
    try {
        const client = new client_1.AppDistributionClient();
        releaseId = await (0, distribution_1.upload)(client, appName, new distribution_1.Distribution(target));
        invokeSpinner.start();
        testInvocations = await invokeTests(client, releaseId, tests, !testDevices.length ? defaultDevices : testDevices);
        invokeSpinner.text = "Test execution requested";
        invokeSpinner.succeed();
    }
    catch (ex) {
        invokeSpinner.fail("Failed to request test execution");
        throw ex;
    }
    logger_1.logger.info(clc.bold(`\n${clc.white("===")} Running ${pluralizeTests(testInvocations.length)}`));
    logger_1.logger.info(await (0, marked_1.marked)(`View progress and results in the Firebase Console`));
});
function pluralizeTests(numTests) {
    return `${numTests} test${numTests === 1 ? "" : "s"}`;
}
async function invokeTests(client, releaseName, testDefs, devices) {
    try {
        const testInvocations = [];
        for (const testDef of testDefs) {
            const aiInstruction = {
                steps: testDef.testCase.steps,
            };
            testInvocations.push(await client.createReleaseTest(releaseName, devices, aiInstruction, undefined, undefined, testDef.testCase.displayName));
        }
        return testInvocations;
    }
    catch (err) {
        throw new error_1.FirebaseError("Test invocation failed", { original: (0, error_1.getError)(err) });
    }
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseTestFiles = parseTestFiles;
const fsutils_1 = require("../fsutils");
const path_1 = require("path");
const logger_1 = require("../logger");
const types_1 = require("./types");
const utils_1 = require("../utils");
const error_1 = require("../error");
async function parseTestFiles(dir, targetUri, filePattern, namePattern) {
    if (targetUri) {
        try {
            new URL(targetUri);
        }
        catch (ex) {
            const errMsg = "Invalid URL" + (targetUri.startsWith("http") ? "" : " (must include protocol)");
            throw new error_1.FirebaseError(errMsg, { original: (0, error_1.getError)(ex) });
        }
    }
    const files = await parseTestFilesRecursive({ testDir: dir, targetUri });
    const idToInvocation = files
        .flatMap((file) => file.invocations)
        .reduce((accumulator, invocation) => {
        if (invocation.testCase.id) {
            accumulator[invocation.testCase.id] = invocation;
        }
        return accumulator;
    }, {});
    const fileFilterFn = createFilter(filePattern);
    const nameFilterFn = createFilter(namePattern);
    const filteredInvocations = files
        .filter((file) => fileFilterFn(file.path))
        .flatMap((file) => file.invocations)
        .filter((invocation) => nameFilterFn(invocation.testCase.displayName));
    return filteredInvocations.map((invocation) => {
        let prerequisiteTestCaseId = invocation.testCase.prerequisiteTestCaseId;
        if (prerequisiteTestCaseId === undefined) {
            return invocation;
        }
        const prerequisiteSteps = [];
        const previousTestCaseIds = new Set();
        while (prerequisiteTestCaseId) {
            if (previousTestCaseIds.has(prerequisiteTestCaseId)) {
                throw new error_1.FirebaseError(`Detected a cycle in prerequisite test cases.`);
            }
            previousTestCaseIds.add(prerequisiteTestCaseId);
            const prerequisiteTestCaseInvocation = idToInvocation[prerequisiteTestCaseId];
            if (prerequisiteTestCaseInvocation === undefined) {
                throw new error_1.FirebaseError(`Invalid prerequisiteTestCaseId. There is no test case with id ${prerequisiteTestCaseId}`);
            }
            prerequisiteSteps.unshift(...prerequisiteTestCaseInvocation.testCase.steps);
            prerequisiteTestCaseId = prerequisiteTestCaseInvocation.testCase.prerequisiteTestCaseId;
        }
        return {
            ...invocation,
            testCase: {
                ...invocation.testCase,
                steps: prerequisiteSteps.concat(invocation.testCase.steps),
            },
        };
    });
}
function createFilter(pattern) {
    const regex = pattern ? new RegExp(pattern) : undefined;
    return (s) => !regex || regex.test(s);
}
async function parseTestFilesRecursive(params) {
    const testDir = params.testDir;
    const targetUri = params.targetUri;
    const items = (0, fsutils_1.listFiles)(testDir);
    const results = [];
    for (const item of items) {
        const path = (0, path_1.join)(testDir, item);
        if ((0, fsutils_1.dirExistsSync)(path)) {
            results.push(...(await parseTestFilesRecursive({ testDir: path, targetUri })));
        }
        else if ((0, fsutils_1.fileExistsSync)(path)) {
            try {
                const file = await (0, utils_1.readFileFromDirectory)(testDir, item);
                logger_1.logger.debug(`Read the file ${file.source}.`);
                const parsedFile = (0, utils_1.wrappedSafeLoad)(file.source);
                logger_1.logger.debug(`Parsed the file.`);
                const tests = parsedFile.tests;
                logger_1.logger.debug(`There are ${tests.length} tests.`);
                const defaultConfig = parsedFile.defaultConfig;
                if (!tests || !tests.length) {
                    logger_1.logger.debug(`No tests found in ${path}. Ignoring.`);
                    continue;
                }
                const invocations = [];
                for (const rawTestDef of tests) {
                    const invocation = toTestCaseInvocation(rawTestDef, targetUri, defaultConfig);
                    invocations.push(invocation);
                }
                results.push({ path, invocations: invocations });
            }
            catch (ex) {
                const errMsg = (0, error_1.getErrMsg)(ex);
                const errDetails = errMsg ? `Error details: \n${errMsg}` : "";
                logger_1.logger.debug(`Unable to parse test file ${path}. Ignoring.${errDetails}`);
                continue;
            }
        }
    }
    return results;
}
function toTestCaseInvocation(testDef, targetUri, defaultConfig) {
    const steps = testDef.steps ?? [];
    const route = testDef.testConfig?.route ?? defaultConfig?.route ?? "";
    const browsers = testDef.testConfig?.browsers ??
        defaultConfig?.browsers ?? [types_1.Browser.CHROME];
    return {
        testCase: {
            id: testDef.id,
            prerequisiteTestCaseId: testDef.prerequisiteTestCaseId,
            startUri: targetUri + route,
            displayName: testDef.displayName,
            steps: steps,
        },
        testExecution: browsers.map((browser) => ({ config: { browser } })),
    };
}

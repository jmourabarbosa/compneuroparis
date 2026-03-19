"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.execute = void 0;
const zod_1 = require("zod");
const tool_1 = require("../../tool");
const dataplane = require("../../../dataconnect/dataplaneClient");
const load_1 = require("../../../dataconnect/load");
const converter_1 = require("../../util/dataconnect/converter");
const emulator_1 = require("../../util/dataconnect/emulator");
exports.execute = (0, tool_1.tool)("dataconnect", {
    name: "execute",
    description: "Use this to execute a GraphQL operation against a Data Connect service or its emulator.",
    inputSchema: zod_1.z.object({
        query: zod_1.z.string().describe(`A Firebase Data Connect GraphQL query or mutation to execute.
You can use the \`dataconnect_generate_operation\` tool to generate a query.
Example Data Connect schema and example queries can be found in files ending in \`.graphql\` or \`.gql\`.
`),
        service_id: zod_1.z
            .string()
            .optional()
            .describe(`Service ID of the Data Connect service to compile. Used to disambiguate when there are multiple Data Connect services in firebase.json.`),
        location_id: zod_1.z
            .string()
            .optional()
            .describe(`Data Connect Service location ID to disambiguate among multiple Data Connect services.`),
        variables_json: zod_1.z
            .string()
            .optional()
            .describe("GraphQL variables to pass into the query. MUST be a valid stringified JSON object."),
        auth_token_json: zod_1.z
            .string()
            .optional()
            .describe("Firebase Auth Token JWT to use in this query. MUST be a valid stringified JSON object." +
            'Importantly, when executing queries with `@auth(level: USER)` or `auth.uid`, a valid Firebase Auth Token JWT with "sub" field is required. ' +
            '"auth.uid" expression in the query evaluates to the value of "sub" field in Firebase Auth token.'),
        use_emulator: zod_1.z
            .boolean()
            .default(false)
            .describe("If true, target the DataConnect emulator. Run `firebase emulators:start` to start it"),
    }),
    annotations: {
        title: "Execute Firebase Data Connect Query",
    },
    _meta: {
        requiresProject: true,
        requiresAuth: true,
    },
}, async ({ query, service_id, location_id, variables_json: unparsedVariables, use_emulator, auth_token_json: unparsedAuthToken, }, { projectId, config, host }) => {
    const serviceInfo = await (0, load_1.pickOneService)(projectId, config, service_id || undefined, location_id || undefined);
    let apiClient;
    if (use_emulator) {
        apiClient = await (0, emulator_1.getDataConnectEmulatorClient)(host);
    }
    else {
        apiClient = dataplane.dataconnectDataplaneClient();
    }
    let executeGraphQL = dataplane.executeGraphQL;
    if (query.startsWith("query")) {
        executeGraphQL = dataplane.executeGraphQLRead;
    }
    const response = await executeGraphQL(apiClient, serviceInfo.serviceName, {
        query,
        variables: (0, converter_1.parseVariables)(unparsedVariables),
        extensions: {
            impersonate: unparsedAuthToken
                ? {
                    authClaims: (0, converter_1.parseVariables)(unparsedAuthToken),
                }
                : undefined,
        },
    });
    return (0, converter_1.graphqlResponseToToolResponse)(response.body);
});

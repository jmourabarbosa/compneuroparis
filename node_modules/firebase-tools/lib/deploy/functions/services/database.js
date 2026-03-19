"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDatabaseTriggerRegion = ensureDatabaseTriggerRegion;
const error_1 = require("../../../error");
function ensureDatabaseTriggerRegion(endpoint) {
    if (!endpoint.eventTrigger.region) {
        endpoint.eventTrigger.region = endpoint.region;
    }
    if (endpoint.eventTrigger.region !== endpoint.region) {
        throw new error_1.FirebaseError("A database trigger location must match the function region.");
    }
    return Promise.resolve();
}

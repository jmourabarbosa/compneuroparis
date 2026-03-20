import { buildInstituteFieldData, resolveLegacyInstituteRefsFromRecord, toArray } from './institute-links.mjs';

function arraysEqual(a = [], b = []) {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function auditInstituteLinks(record = {}, institutes = []) {
  const storedIds = toArray(record.instituteIds);
  const storedNames = toArray(record.institutes || record.institute);
  const resolvedRefs = storedIds.length > 0
    ? storedIds.map(id => ({ id }))
    : resolveLegacyInstituteRefsFromRecord(record, institutes);
  const unresolved = resolvedRefs.filter(ref => !ref.id);
  const nextFields = buildInstituteFieldData(resolvedRefs);
  const needsUpdate = resolvedRefs.length > 0 && unresolved.length === 0 && (
    !arraysEqual(storedIds, nextFields.instituteIds)
    || storedNames.length > 0
  );

  return {
    hasLinks: storedIds.length > 0 || storedNames.length > 0,
    storedIds,
    storedNames,
    resolvedRefs,
    unresolved,
    nextFields,
    needsUpdate
  };
}

export function summarizeInstituteLinkAudit(records = [], institutes = []) {
  const summary = {
    total: records.length,
    noLinks: 0,
    clean: 0,
    needsUpdate: 0,
    unresolved: 0
  };

  for (const record of records) {
    const audit = auditInstituteLinks(record, institutes);
    if (!audit.hasLinks) {
      summary.noLinks += 1;
    } else if (audit.unresolved.length > 0) {
      summary.unresolved += 1;
    } else if (audit.needsUpdate) {
      summary.needsUpdate += 1;
    } else {
      summary.clean += 1;
    }
  }

  return summary;
}

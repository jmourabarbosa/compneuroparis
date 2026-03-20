import { toArray } from './institute-links.mjs';

export function getRecordInstituteNames(record = {}) {
  return toArray(record.institutes?.length ? record.institutes : record.institute);
}

export function buildInstituteRenameUpdate(record = {}, previousName, nextName) {
  const institutes = getRecordInstituteNames(record);
  const matchesPreviousName = institutes.includes(previousName) || (record.institute || '') === previousName;

  if (!previousName || !nextName || previousName === nextName || !matchesPreviousName) {
    return null;
  }

  const nextInstitutes = institutes.map(name => (name === previousName ? nextName : name));
  const updateData = {
    institutes: nextInstitutes
  };

  if ((record.institute || '') === previousName) {
    updateData.institute = nextName;
  }

  return updateData;
}

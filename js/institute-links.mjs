export function toArray(value) {
  return Array.isArray(value) ? value : (value ? [value] : []);
}

export function normalizeInstituteName(value) {
  return (value || '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function instituteNamesMatch(a, b) {
  const normalizedA = normalizeInstituteName(a);
  const normalizedB = normalizeInstituteName(b);
  if (!normalizedA || !normalizedB) return false;
  return normalizedA === normalizedB
    || normalizedA.includes(normalizedB)
    || normalizedB.includes(normalizedA);
}

export function resolveInstituteRefsFromRecord(record = {}, availableInstitutes = []) {
  const institutesById = new Map(availableInstitutes.map(inst => [inst.id, inst]));
  const storedNames = toArray(record.institutes || record.institute);
  const storedIds = toArray(record.instituteIds);

  if (storedIds.length > 0) {
    return storedIds.map((id, index) => ({
      id,
      name: institutesById.get(id)?.name || storedNames[index] || storedNames[0] || ''
    }));
  }

  return storedNames.map(name => {
    const matchedInstitute = availableInstitutes.find(inst => instituteNamesMatch(inst.name, name));
    return {
      id: matchedInstitute?.id || '',
      name: matchedInstitute?.name || name
    };
  });
}

export function buildInstituteFieldData(instituteRefs = []) {
  const refs = instituteRefs.filter(ref => ref && ref.name);
  const institutes = refs.map(ref => ref.name);
  const instituteIds = refs.map(ref => ref.id).filter(Boolean);

  return {
    instituteIds,
    institutes,
    institute: institutes[0] || ''
  };
}

export function getInstituteDisplayNames(record = {}, availableInstitutes = []) {
  return resolveInstituteRefsFromRecord(record, availableInstitutes)
    .map(ref => ref.name)
    .filter(Boolean);
}

export function toArray(value) {
  return Array.isArray(value) ? value : (value ? [value] : []);
}

function normalizeInstituteName(value) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function resolveInstituteRefsFromRecord(record = {}, availableInstitutes = []) {
  const institutesById = new Map(availableInstitutes.map(inst => [inst.id, inst]));
  const institutesByNormalizedName = new Map(
    availableInstitutes
      .filter(inst => inst?.id && inst?.name)
      .map(inst => [normalizeInstituteName(inst.name), inst])
  );
  const storedIds = toArray(record.instituteIds).filter(Boolean);
  const legacyNames = [
    ...toArray(record.institutes),
    ...toArray(record.institute)
  ].filter(Boolean);
  const refs = [];
  const seenIds = new Set();

  storedIds.forEach(id => {
    if (seenIds.has(id)) return;
    seenIds.add(id);
    refs.push({
      id,
      name: institutesById.get(id)?.name || ''
    });
  });

  legacyNames.forEach(name => {
    const matchedInstitute = institutesByNormalizedName.get(normalizeInstituteName(name));
    if (!matchedInstitute?.id || seenIds.has(matchedInstitute.id)) return;
    seenIds.add(matchedInstitute.id);
    refs.push({
      id: matchedInstitute.id,
      name: matchedInstitute.name
    });
  });

  return refs;
}

export function buildInstituteFieldData(instituteRefs = []) {
  const refs = instituteRefs.filter(ref => ref?.id);
  const instituteIds = [...new Set(refs.map(ref => ref.id))];

  return {
    instituteIds
  };
}

export function getInstituteDisplayNames(record = {}, availableInstitutes = []) {
  return resolveInstituteRefsFromRecord(record, availableInstitutes)
    .map(ref => ref.name)
    .filter(Boolean);
}

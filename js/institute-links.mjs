export function toArray(value) {
  return Array.isArray(value) ? value : (value ? [value] : []);
}

export function resolveInstituteRefsFromRecord(record = {}, availableInstitutes = []) {
  const institutesById = new Map(availableInstitutes.map(inst => [inst.id, inst]));
  const storedIds = toArray(record.instituteIds);

  return storedIds
    .filter(Boolean)
    .map(id => ({
      id,
      name: institutesById.get(id)?.name || ''
    }));
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

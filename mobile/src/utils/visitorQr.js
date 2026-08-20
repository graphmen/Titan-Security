/** Parse visitor badge QR payload into form fields. */
export function parseVisitorQr(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;

  try {
    const json = JSON.parse(raw);
    const name = json.name || json.fullName || json.visitorName || '';
    if (name) {
      return {
        name,
        idNumber: json.idNumber || json.id || json.nationalId || json.passport || '',
        company: json.company || json.organization || json.org || '',
        vehiclePlate: json.vehiclePlate || json.plate || json.vehicle || '',
      };
    }
  } catch {
    /* not JSON */
  }

  if (raw.includes('|')) {
    const [name, idNumber, company, vehiclePlate] = raw.split('|').map((s) => s.trim());
    if (name) {
      return {
        name,
        idNumber: idNumber || '',
        company: company || '',
        vehiclePlate: vehiclePlate || '',
      };
    }
  }

  if (raw.includes(',')) {
    const [name, idNumber, company, vehiclePlate] = raw.split(',').map((s) => s.trim());
    if (name && idNumber) {
      return {
        name,
        idNumber,
        company: company || '',
        vehiclePlate: vehiclePlate || '',
      };
    }
  }

  return { name: raw, idNumber: '', company: '', vehiclePlate: '' };
}

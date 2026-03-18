const NormalizeContactNumber = (rawNumber: string): string => {
  const digits = String(rawNumber || "").replace(/\D/g, "");

  if (!digits) {
    return digits;
  }

  if (digits.startsWith("55")) {
    return digits;
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
};

export default NormalizeContactNumber;

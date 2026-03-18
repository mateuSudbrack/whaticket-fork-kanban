import NormalizeContactNumber from "./NormalizeContactNumber";

const GetContactNumberVariants = (rawNumber: string): string[] => {
  const digits = String(rawNumber || "").replace(/\D/g, "");

  if (!digits) {
    return [];
  }

  const normalized = NormalizeContactNumber(digits);
  const withoutCountryCode = normalized.startsWith("55")
    ? normalized.slice(2)
    : normalized;

  return Array.from(new Set([digits, normalized, withoutCountryCode])).filter(Boolean);
};

export default GetContactNumberVariants;

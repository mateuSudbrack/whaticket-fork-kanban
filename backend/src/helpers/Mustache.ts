import Mustache from "mustache";
import Contact from "../models/Contact";

const normalizeFieldKey = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export default (body: string, contact: Contact): string => {
  const customFields = ((contact as any)?.extraInfo || []).reduce(
    (acc: Record<string, string>, field: any) => {
      const name = String(field?.fieldDefinition?.name || field?.name || "");
      const key = normalizeFieldKey(name);

      if (!key) {
        return acc;
      }

      acc[key] = String(field?.value || "");
      return acc;
    },
    {}
  );

  const view = {
    name: contact ? contact.name : "",
    email: (contact as any)?.email || "",
    number: (contact as any)?.number || "",
    phone: (contact as any)?.number || "",
    custom: customFields,
    fields: customFields,
    ...customFields
  };

  return Mustache.render(body, view);
};

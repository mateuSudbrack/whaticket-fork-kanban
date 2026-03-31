import { Op } from "sequelize";
import AppError from "../../errors/AppError";
import ContactCustomField from "../../models/ContactCustomField";
import ContactFieldDefinition from "../../models/ContactFieldDefinition";
import ShowContactService from "../ContactServices/ShowContactService";
import { listCertificateOrdersByContact } from "./CertificateGatewayService";

const CERTIFICATE_CONTACT_FIELD_DEFINITIONS = [
  { key: "pedido_identificador", name: "Pedido Identificador", type: "text", sortOrder: 900 },
  { key: "pedido_protocolo", name: "Pedido Protocolo", type: "text", sortOrder: 901 },
  { key: "pedido_nome", name: "Pedido Nome", type: "text", sortOrder: 902 },
  { key: "pedido_cpf_cnpj", name: "Pedido CPF CNPJ", type: "text", sortOrder: 903 },
  { key: "pedido_email", name: "Pedido Email", type: "text", sortOrder: 904 },
  { key: "pedido_telefone", name: "Pedido Telefone", type: "text", sortOrder: 905 },
  { key: "pedido_produto", name: "Pedido Produto", type: "text", sortOrder: 906 },
  { key: "pedido_situacao", name: "Pedido Situacao", type: "text", sortOrder: 907 },
  { key: "pedido_data", name: "Pedido Data", type: "text", sortOrder: 908 }
] as const;

const normalizeText = (value: any) => String(value || "").trim();

const normalizeFieldKey = (value: string) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

async function ensureCertificateContactFieldDefinitions() {
  const names = CERTIFICATE_CONTACT_FIELD_DEFINITIONS.map(field => field.name);
  const existingDefinitions = await ContactFieldDefinition.findAll({
    where: {
      name: {
        [Op.in]: names
      }
    }
  });

  const existingByName = new Map(
    existingDefinitions.map(definition => [String(definition.name), definition])
  );

  const definitionsByKey = new Map<string, ContactFieldDefinition>();

  for (const field of CERTIFICATE_CONTACT_FIELD_DEFINITIONS) {
    let definition = existingByName.get(field.name);

    if (!definition) {
      definition = await ContactFieldDefinition.create({
        name: field.name,
        type: field.type,
        required: false,
        active: true,
        sortOrder: field.sortOrder
      });
    } else if (
      definition.type !== field.type ||
      definition.active !== true ||
      Number(definition.sortOrder || 0) !== field.sortOrder
    ) {
      await definition.update({
        type: field.type,
        active: true,
        sortOrder: field.sortOrder
      });
    }

    definitionsByKey.set(field.key, definition);
  }

  return definitionsByKey;
}

function extractOrderFieldValues(order: any) {
  return {
    pedido_identificador: normalizeText(order?.identifier),
    pedido_protocolo: normalizeText(order?.protocol),
    pedido_nome: normalizeText(order?.customerName),
    pedido_cpf_cnpj: normalizeText(order?.document),
    pedido_email: normalizeText(order?.email),
    pedido_telefone: normalizeText(order?.phone),
    pedido_produto: normalizeText(order?.productName),
    pedido_situacao: normalizeText(order?.status),
    pedido_data: normalizeText(order?.dateLabel)
  };
}

type SyncRequest = {
  contactId: string | number;
  orderIdentifier?: string | number | null;
};

const SyncContactCertificateFieldsService = async ({
  contactId,
  orderIdentifier
}: SyncRequest) => {
  const contact = await ShowContactService(contactId);
  const certificatePayload = await listCertificateOrdersByContact(contact.id, {
    page: 1,
    limit: 20,
    all: true
  });

  const orders = Array.isArray(certificatePayload?.orders)
    ? certificatePayload.orders
    : [];

  const selectedOrder = orderIdentifier
    ? orders.find(
        (order: any) =>
          String(order?.identifier || "") === String(orderIdentifier)
      )
    : orders[0];

  if (!selectedOrder) {
    throw new AppError(
      "Nenhum pedido encontrado para carregar nos campos do contato.",
      404
    );
  }

  const definitionsByKey = await ensureCertificateContactFieldDefinitions();
  const existingByDefinitionId = new Map(
    (contact.extraInfo || [])
      .filter(info => info?.fieldDefinitionId)
      .map(info => [Number(info.fieldDefinitionId), info])
  );
  const existingByKey = new Map(
    (contact.extraInfo || []).map(info => [
      normalizeFieldKey(
        String(info?.fieldDefinition?.name || info?.name || "")
      ),
      info
    ])
  );
  const values = extractOrderFieldValues(selectedOrder);

  for (const field of CERTIFICATE_CONTACT_FIELD_DEFINITIONS) {
    const definition = definitionsByKey.get(field.key);
    if (!definition) {
      continue;
    }

    const existingField =
      existingByDefinitionId.get(Number(definition.id)) ||
      existingByKey.get(field.key);
    const value = values[field.key] || "";

    if (existingField) {
      await existingField.update({
        name: definition.name,
        fieldDefinitionId: definition.id,
        contactId: contact.id,
        value
      });
      continue;
    }

    await ContactCustomField.create({
      name: definition.name,
      fieldDefinitionId: definition.id,
      contactId: contact.id,
      value
    });
  }

  const updatedContact = await ShowContactService(contact.id);

  return {
    contact: updatedContact,
    order: selectedOrder,
    fields: values
  };
};

export default SyncContactCertificateFieldsService;

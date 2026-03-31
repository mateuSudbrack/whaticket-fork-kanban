import AppError from "../../errors/AppError";
import ShowContactService from "../ContactServices/ShowContactService";
import NormalizeContactNumber from "../../helpers/NormalizeContactNumber";

declare const fetch: any;

type GatewayRequestOptions = {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  retrying?: boolean;
};

type CertificatesSession = {
  token: string;
  userId: number;
  expiresAt: number;
};

const certificatesApiUrl = String(
  process.env.CERTIFICATES_API_URL || "http://127.0.0.1:3333"
)
  .trim()
  .replace(/\/+$/, "");
const certificatesAdminEmail = String(
  process.env.CERTIFICATES_ADMIN_EMAIL || "admin@local.test"
).trim();
const certificatesAdminPassword = String(
  process.env.CERTIFICATES_ADMIN_PASSWORD || "Senha1234"
);

let cachedSession: CertificatesSession | null = null;

function decodeBase64Url(value: string): string {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const remainder = normalized.length % 4;
  const padded =
    remainder === 0 ? normalized : normalized + "=".repeat(4 - remainder);
  return Buffer.from(padded, "base64").toString("utf8");
}

function parseTokenExpiration(token: string): number {
  try {
    const [encodedPayload] = String(token || "").split(".");
    const payload = JSON.parse(decodeBase64Url(encodedPayload));
    const exp = Number(payload?.exp || 0);
    if (!exp) {
      return Date.now() + 10 * 60 * 1000;
    }
    return Math.max(exp * 1000 - 30 * 1000, Date.now() + 60 * 1000);
  } catch (_error) {
    return Date.now() + 10 * 60 * 1000;
  }
}

async function loginCertificatesAdmin(): Promise<CertificatesSession> {
  if (!certificatesApiUrl || !certificatesAdminEmail || !certificatesAdminPassword) {
    throw new AppError("Integração de certificados não configurada.", 500);
  }

  const response = await fetch(`${certificatesApiUrl}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      email: certificatesAdminEmail,
      password: certificatesAdminPassword
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.token || !payload?.user?.id) {
    throw new AppError(
      payload?.error || "Falha ao autenticar no módulo de certificados.",
      response.status || 502
    );
  }

  cachedSession = {
    token: payload.token,
    userId: Number(payload.user.id),
    expiresAt: parseTokenExpiration(payload.token)
  };

  return cachedSession;
}

async function getCertificatesSession(force = false): Promise<CertificatesSession> {
  if (!force && cachedSession && cachedSession.expiresAt > Date.now()) {
    return cachedSession;
  }

  return loginCertificatesAdmin();
}

async function requestCertificates(
  path: string,
  options: GatewayRequestOptions = {}
): Promise<any> {
  const session = await getCertificatesSession(options.retrying === true);
  const method = options.method || "GET";
  const isFormDataBody =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.token}`,
    ...(options.headers || {})
  };
  const isJsonBody =
    !isFormDataBody &&
    options.body &&
    typeof options.body === "object" &&
    !(options.body instanceof Buffer) &&
    !(typeof Blob !== "undefined" && options.body instanceof Blob);

  if (isJsonBody && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${certificatesApiUrl}${path}`, {
    method,
    headers,
    body: isJsonBody ? JSON.stringify(options.body) : options.body
  });

  const isJson = String(response.headers.get("content-type") || "").includes(
    "application/json"
  );
  const payload = isJson
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => "");

  if ((response.status === 401 || response.status === 403) && !options.retrying) {
    cachedSession = null;
    return requestCertificates(path, {
      ...options,
      retrying: true
    });
  }

  if (!response.ok) {
    throw new AppError(
      payload?.error || payload?.message || "Falha na integração de certificados.",
      response.status || 502
    );
  }

  return payload;
}

export async function listCertificateOrders(params: {
  search?: string;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}) {
  const session = await getCertificatesSession();
  const query = new URLSearchParams({
    userId: String(session.userId),
    search: String(params.search || ""),
    page: String(params.page || 1),
    limit: String(params.limit || 20)
  });

  if (params.startDate) {
    query.set("startDate", params.startDate);
  }
  if (params.endDate) {
    query.set("endDate", params.endDate);
  }

  return requestCertificates(`/orders?${query.toString()}`);
}

export async function listCertificateOrdersByContact(
  contactId: string | number,
  params: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    all?: boolean;
  } = {}
) {
  const contact = await ShowContactService(contactId);
  const normalizedPhone = NormalizeContactNumber(contact.number || "");

  if (!normalizedPhone) {
    return {
      contact: {
        id: contact.id,
        name: contact.name,
        number: contact.number
      },
      orders: [],
      pagination: {
        page: params.page || 1,
        limit: params.limit || 20,
        total: 0,
        totalPages: 0,
        hasNextPage: false
      },
      phoneVariants: []
    };
  }

  const query = new URLSearchParams({
    phone: normalizedPhone,
    page: String(params.page || 1),
    limit: String(params.limit || 20)
  });

  if (params.startDate) {
    query.set("startDate", params.startDate);
  }
  if (params.endDate) {
    query.set("endDate", params.endDate);
  }
  if (params.all) {
    query.set("all", "true");
  }

  const payload = await requestCertificates(`/orders/by-phone?${query.toString()}`);
  return {
    ...payload,
    contact: {
      id: contact.id,
      name: contact.name,
      number: contact.number,
      normalizedNumber: normalizedPhone
    }
  };
}

export async function lookupCertificateCustomerByDocument(document: string) {
  const query = new URLSearchParams({ document: String(document || "") });
  return requestCertificates(`/lookups/customer-by-document?${query.toString()}`);
}

export async function listCertificateProducts(params: {
  search?: string;
  personType?: string;
}) {
  const query = new URLSearchParams();
  if (params.search) {
    query.set("search", params.search);
  }
  if (params.personType) {
    query.set("personType", params.personType);
  }

  const suffix = query.toString() ? `?${query.toString()}` : "";
  return requestCertificates(`/lookups/create-order-products${suffix}`);
}

export async function createCertificateOrder(body: Record<string, any>) {
  return requestCertificates("/orders/create", {
    method: "POST",
    body
  });
}

export async function runCertificateAgentChat(params: {
  messages: Array<{ role: string; content: string }>;
  attachments?: Array<{
    buffer: Buffer;
    originalname: string;
    mimetype: string;
  }>;
}) {
  const formData = new FormData();
  formData.append("messages", JSON.stringify(params.messages || []));

  for (const file of params.attachments || []) {
    formData.append(
      "attachments",
      new Blob([file.buffer], {
        type: String(file.mimetype || "application/octet-stream")
      }),
      String(file.originalname || "anexo")
    );
  }

  return requestCertificates("/agent-chat", {
    method: "POST",
    body: formData
  });
}

export async function createCertificateRealtimeSession() {
  return requestCertificates("/realtime/session", {
    method: "POST",
  });
}

export async function executeCertificateRealtimeTool(body: {
  name: string;
  args?: Record<string, any>;
  latestUserMessage?: string;
}) {
  return requestCertificates("/realtime/tool-call", {
    method: "POST",
    body
  });
}

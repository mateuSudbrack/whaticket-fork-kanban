import Constants from "expo-constants";
import * as DocumentPicker from "expo-document-picker";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
} from "expo-audio";
import * as BackgroundTask from "expo-background-task";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import * as TaskManager from "expo-task-manager";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import {
  SafeAreaProvider,
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const defaultApiUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  "https://api-whaticket.digiyou.com.br";

const sections = [
  { key: "tickets", label: "Tickets" },
  { key: "contacts", label: "Contatos" },
  { key: "certificates", label: "Certificados" },
  { key: "config", label: "Config" },
];

const certificateViews = [
  { key: "orders", label: "Pedidos" },
  { key: "create", label: "Criar pedido" },
  { key: "chat", label: "Chat" },
];

const CERTIFICATE_PAGE_SIZE = 20;
const CERTIFICATE_PAYMENT_OPTIONS = [
  { id: "241", label: "PIX" },
  { id: "242", label: "Credito" },
  { id: "267", label: "Boleto" },
];
const CERTIFICATE_VALIDATION_OPTIONS = [
  { id: "0", label: "Presencial" },
  { id: "1", label: "Videoconferencia" },
  { id: "2", label: "Online" },
];
const EMPTY_CERTIFICATE_CREATE_FORM = {
  document: "",
  personType: "pf",
  customerName: "",
  customerEmail: "",
  customerPhone: "",
  customerBirthDate: "",
  addressRaw: "",
  cep: "",
  municipality: "",
  uf: "",
  neighborhood: "",
  number: "0",
  street: "",
  productSearch: "",
  selectedProductKey: "",
  productCode: "",
  productName: "",
  certificateValue: "",
  paymentMethod: "241",
  validationType: "1",
  indicationDocument: "",
  indicationType: "",
  indicationRaw: "",
  representativeName: "",
  representativeDocument: "",
  representativePhone: "",
  representativeEmail: "",
  representativeBirthDate: "",
};
const INITIAL_CERTIFICATE_CHAT_MESSAGES = [
  {
    role: "assistant",
    content:
      "Envie texto, PDF, imagem ou áudio do cliente. Eu consulto a base e monto o pedido."
  }
];

function buildCertificateRealtimeWebViewHtml() {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" />
    <title>Realtime Voz</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background: #f8fafc;
        color: #0f172a;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .shell {
        padding: 16px;
      }
      .row {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      button {
        border: 0;
        border-radius: 14px;
        padding: 12px 15px;
        font: inherit;
        font-weight: 700;
      }
      .primary {
        background: #3f51b5;
        color: white;
      }
      .secondary {
        background: #e2e8f0;
        color: #334155;
      }
      .status {
        margin-top: 12px;
        min-height: 20px;
        color: #334155;
        line-height: 1.5;
      }
      .status.error {
        color: #b91c1c;
      }
      .hint {
        color: #475569;
        line-height: 1.5;
        margin-bottom: 14px;
      }
      .log {
        margin-top: 14px;
        background: white;
        border-radius: 18px;
        padding: 14px;
        min-height: 260px;
        white-space: pre-wrap;
        line-height: 1.45;
        font-size: 13px;
        border: 1px solid #dbe3ef;
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <div class="hint">
        Toque em <strong>Iniciar voz</strong> e fale normalmente. O agente usa as mesmas
        ferramentas do chat para consultar cliente, listar produtos e criar pedido.
      </div>
      <div class="row">
        <button class="primary" id="start-button">Iniciar voz</button>
        <button class="secondary" id="stop-button">Encerrar</button>
      </div>
      <div class="status" id="status">Aguardando início.</div>
      <div class="log" id="log"></div>
      <audio id="remote-audio" autoplay playsinline></audio>
    </div>
    <script>
      let peerConnection = null;
      let dataChannel = null;
      let mediaStream = null;
      let latestUserMessage = "";
      let currentSession = null;
      let requestCounter = 0;
      const pendingRequests = new Map();
      const handledToolCalls = new Set();

      const statusElement = document.getElementById("status");
      const logElement = document.getElementById("log");
      const remoteAudio = document.getElementById("remote-audio");

      function setStatus(text, isError) {
        statusElement.textContent = text || "";
        statusElement.className = isError ? "status error" : "status";
      }

      function appendLog(line) {
        logElement.textContent = logElement.textContent
          ? logElement.textContent + "\\n" + line
          : line;
        logElement.scrollTop = logElement.scrollHeight;
      }

      function postToNative(message) {
        if (!window.ReactNativeWebView) {
          throw new Error("Bridge nativo indisponível no WebView.");
        }
        window.ReactNativeWebView.postMessage(JSON.stringify(message));
      }

      function requestNative(type, payload) {
        return new Promise((resolve, reject) => {
          const requestId = "req_" + Date.now() + "_" + ++requestCounter;
          pendingRequests.set(requestId, { resolve, reject });
          postToNative({
            type,
            requestId,
            payload: payload || {},
          });
        });
      }

      window.__rnReceive = function __rnReceive(rawMessage) {
        let message = rawMessage;
        if (typeof message === "string") {
          try {
            message = JSON.parse(message);
          } catch (_error) {
            return;
          }
        }
        if (!message || !message.requestId) {
          return;
        }
        const pending = pendingRequests.get(message.requestId);
        if (!pending) {
          return;
        }
        pendingRequests.delete(message.requestId);
        if (message.error) {
          pending.reject(new Error(message.error));
          return;
        }
        pending.resolve(message.payload || {});
      };

      function capabilityErrors() {
        const failures = [];
        if (!window.isSecureContext) {
          failures.push("O WebView não abriu em contexto seguro.");
        }
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          failures.push("Microfone indisponível no WebView.");
        }
        if (typeof window.RTCPeerConnection !== "function") {
          failures.push("WebRTC indisponível no WebView.");
        }
        return failures;
      }

      async function executeRealtimeTool(name, args) {
        const response = await requestNative("tool_call", {
          name,
          args,
          latestUserMessage,
        });
        return response.result;
      }

      async function handleRealtimeEvent(payload) {
        if (payload.type === "conversation.item.input_audio_transcription.completed") {
          latestUserMessage = payload.transcript || "";
          appendLog("Você: " + (latestUserMessage || "[sem transcrição]"));
          return;
        }

        if (payload.type === "response.audio_transcript.done") {
          appendLog("Agente: " + (payload.transcript || "[sem transcrição]"));
          return;
        }

        if (payload.type === "response.function_call_arguments.done") {
          if (!dataChannel || handledToolCalls.has(payload.call_id)) {
            return;
          }

          handledToolCalls.add(payload.call_id);
          let args = {};
          try {
            args = payload.arguments ? JSON.parse(payload.arguments) : {};
          } catch (_error) {
            args = {};
          }

          appendLog("Ferramenta: " + payload.name);
          try {
            const result = await executeRealtimeTool(payload.name, args);
            dataChannel.send(
              JSON.stringify({
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id: payload.call_id,
                  output: JSON.stringify(result),
                },
              }),
            );
            dataChannel.send(JSON.stringify({ type: "response.create" }));
          } catch (error) {
            const message = error && error.message ? error.message : "Falha na ferramenta realtime.";
            appendLog("Falha na ferramenta " + payload.name + ": " + message);
            dataChannel.send(
              JSON.stringify({
                type: "conversation.item.create",
                item: {
                  type: "function_call_output",
                  call_id: payload.call_id,
                  output: JSON.stringify({
                    ok: false,
                    error: message,
                  }),
                },
              }),
            );
            dataChannel.send(JSON.stringify({ type: "response.create" }));
          }
          return;
        }

        if (payload.type === "error") {
          appendLog("Erro realtime: " + (payload.error && payload.error.message ? payload.error.message : "erro desconhecido"));
          return;
        }
      }

      async function startRealtime() {
        if (peerConnection) {
          setStatus("Sessão realtime já está aberta.");
          return;
        }

        const failures = capabilityErrors();
        if (failures.length) {
          setStatus(failures.join(" "), true);
          appendLog("Capacidades ausentes: " + failures.join(" "));
          return;
        }

        try {
          setStatus("Abrindo sessão realtime...");
          appendLog("Solicitando token efêmero...");
          currentSession = await requestNative("request_session");
          if (!currentSession.clientSecret) {
            throw new Error("Sessão realtime sem token efêmero.");
          }

          mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          peerConnection = new RTCPeerConnection();

          peerConnection.ontrack = (event) => {
            if (event.streams && event.streams[0]) {
              remoteAudio.srcObject = event.streams[0];
            }
          };

          mediaStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, mediaStream);
          });

          dataChannel = peerConnection.createDataChannel("oai-events");
          dataChannel.onmessage = async (event) => {
            try {
              const payload = JSON.parse(event.data);
              await handleRealtimeEvent(payload);
            } catch (_error) {
              appendLog("Evento bruto: " + event.data);
            }
          };

          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);

          appendLog("Negociando WebRTC com o modelo " + currentSession.model + "...");
          const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
            method: "POST",
            body: offer.sdp,
            headers: {
              Authorization: "Bearer " + currentSession.clientSecret,
              "Content-Type": "application/sdp",
            },
          });

          if (!sdpResponse.ok) {
            const errorText = await sdpResponse.text().catch(() => "");
            throw new Error(
              "Falha no handshake realtime: HTTP " +
                sdpResponse.status +
                (errorText ? " - " + errorText : ""),
            );
          }

          const answer = {
            type: "answer",
            sdp: await sdpResponse.text(),
          };
          await peerConnection.setRemoteDescription(answer);

          setStatus("Sessão realtime ativa. Pode falar.");
          appendLog("Sessão realtime conectada.");
        } catch (error) {
          const message = error && error.message ? error.message : "Falha no realtime.";
          setStatus(message, true);
          appendLog("Falha: " + message);
          stopRealtime(false);
        }
      }

      function stopRealtime(updateStatus) {
        if (dataChannel) {
          dataChannel.close();
          dataChannel = null;
        }
        if (peerConnection) {
          peerConnection.close();
          peerConnection = null;
        }
        if (mediaStream) {
          mediaStream.getTracks().forEach((track) => track.stop());
          mediaStream = null;
        }
        remoteAudio.srcObject = null;
        latestUserMessage = "";
        currentSession = null;
        handledToolCalls.clear();
        if (updateStatus !== false) {
          setStatus("Sessão realtime encerrada.");
          appendLog("Sessão realtime encerrada.");
        }
      }

      document.getElementById("start-button").addEventListener("click", startRealtime);
      document.getElementById("stop-button").addEventListener("click", () => stopRealtime(true));
      appendLog("Tela realtime carregada.");
      appendLog("Secure context: " + (window.isSecureContext ? "sim" : "não"));
      appendLog("mediaDevices: " + (!!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) ? "sim" : "não"));
      appendLog("RTCPeerConnection: " + (typeof window.RTCPeerConnection === "function" ? "sim" : "não"));
    </script>
  </body>
</html>`;
}

const CERTIFICATE_REALTIME_WEBVIEW_HTML = buildCertificateRealtimeWebViewHtml();

const ticketViews = [
  { key: "inbox", label: "Inbox" },
  { key: "open", label: "Atendendo" },
  { key: "pending", label: "Aguardando" },
  { key: "closed", label: "Resolvidas" },
  { key: "kanban", label: "Kanban" },
];

const principalKanbanColumns = [
  { id: "pending", title: "Aguardando", color: "#f59e0b" },
  { id: "open", title: "Em atendimento", color: "#3f51b5" },
  { id: "closed", title: "Resolvido", color: "#16a34a" },
];

const APP_NAME_FALLBACK = "Whaticket";
const APP_VERSION = String(
  Constants.nativeAppVersion || Constants.expoConfig?.version || "0.1.0",
);
const DEFAULT_PUBLIC_SETTINGS = {
  appName: APP_NAME_FALLBACK,
  appLogoUrl: "",
  mobileAppLatestVersion: APP_VERSION,
  mobileAppDownloadUrl: "",
};

const AUTH_STORAGE_KEY = "whaticket_mobile_auth";
const TICKET_SNAPSHOT_KEY = "whaticket_mobile_ticket_snapshot";
const BACKGROUND_TASK_NAME = "whaticket-mobile-background-refresh";
const FOREGROUND_REFRESH_INTERVAL_MS = 30000;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

async function getStoredJson(key) {
  const value = await SecureStore.getItemAsync(key);
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
}

async function setStoredJson(key, value) {
  await SecureStore.setItemAsync(key, JSON.stringify(value));
}

function createTicketSnapshot(tickets = []) {
  const items = {};
  let badgeCount = 0;

  tickets.forEach(ticket => {
    items[String(ticket.id)] = {
      id: ticket.id,
      status: ticket.status,
      unreadMessages: Number(ticket.unreadMessages || 0),
      updatedAt: ticket.updatedAt || "",
      contactName: ticket.contact?.name || ticket.contact?.number || `#${ticket.id}`,
      lastMessage: ticket.lastMessage || "",
    };
    badgeCount += Number(ticket.unreadMessages || 0);
  });

  return {
    updatedAt: new Date().toISOString(),
    badgeCount,
    items,
  };
}

function collectNotificationEvents(previousSnapshot, tickets = []) {
  const previousItems = previousSnapshot?.items || {};

  return tickets
    .map(ticket => {
      const previous = previousItems[String(ticket.id)];
      const currentUnread = Number(ticket.unreadMessages || 0);
      const previousUnread = Number(previous?.unreadMessages || 0);
      const isNewPendingTicket = !previous && String(ticket.status) === "pending";
      const unreadIncreased = currentUnread > previousUnread;

      if (!isNewPendingTicket && !unreadIncreased) {
        return null;
      }

      return {
        id: ticket.id,
        title: isNewPendingTicket
          ? `Novo ticket: ${ticket.contact?.name || ticket.contact?.number || `#${ticket.id}`}`
          : `${ticket.contact?.name || ticket.contact?.number || `#${ticket.id}`}`,
        body: ticket.lastMessage || "Nova atividade no ticket",
      };
    })
    .filter(Boolean)
    .slice(0, 3);
}

async function syncTicketNotifications(tickets = [], notify = true) {
  const previousSnapshot = await getStoredJson(TICKET_SNAPSHOT_KEY);
  const nextSnapshot = createTicketSnapshot(tickets);
  const events = notify ? collectNotificationEvents(previousSnapshot, tickets) : [];

  if (notify) {
    for (const event of events) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: event.title,
          body: event.body,
          data: { ticketId: event.id },
        },
        trigger: null,
      });
    }
  }

  await Notifications.setBadgeCountAsync(nextSnapshot.badgeCount);
  await setStoredJson(TICKET_SNAPSHOT_KEY, nextSnapshot);

  return events;
}

function mapSettingsArray(items = []) {
  return items.reduce((acc, item) => {
    acc[item.key] = item.value;
    return acc;
  }, {});
}

function normalizeApiUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function formatDateInput(date) {
  return date.toISOString().slice(0, 10);
}

function getCurrentMonthRange() {
  const now = new Date();
  return {
    startDate: formatDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
    endDate: formatDateInput(now),
  };
}

function normalizeDocumentDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function isCompanyDocument(value) {
  return normalizeDocumentDigits(value).length > 11;
}

function createProductKey(product) {
  return `${product.productCode || ""}::${product.productName || ""}`;
}

function normalizeValueForApi(value) {
  return String(value || "")
    .trim()
    .replace(/\./g, "")
    .replace(",", ".");
}

function formatBirthDateForPayload(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  }

  return raw;
}

function buildCertificateCreateOrderPayload(form) {
  const documentDigits = normalizeDocumentDigits(form.document);
  const indicationDigits = normalizeDocumentDigits(form.indicationDocument);
  const payload = {
    pedido: {
      id: Math.floor(Date.now() / 1000),
      data: formatDateInput(new Date()),
      pontoAtendimento: 1,
      formaPagamento: Number(form.paymentMethod || 241),
      pago: false,
      tipoValidacao: Number(form.validationType || 1),
    },
    cliente: {
      nome: String(form.customerName || "").trim(),
      email: String(form.customerEmail || "").trim(),
      telefone: String(form.customerPhone || "").trim(),
      cep: normalizeDocumentDigits(form.cep),
      municipio: String(form.municipality || "").trim(),
      uf: String(form.uf || "").trim().toUpperCase(),
      bairro: String(form.neighborhood || "").trim(),
      numero: String(form.number || "0").trim() || "0",
      logradouro: String(form.street || "").trim(),
    },
    certificado: {
      id: Number(form.productCode || 0),
      valor: normalizeValueForApi(form.certificateValue),
    },
  };

  if (indicationDigits.length === 11) {
    payload.indicacao = { cpf: indicationDigits };
  } else if (indicationDigits.length >= 12) {
    payload.indicacao = { cnpj: indicationDigits };
  }

  if (isCompanyDocument(documentDigits)) {
    payload.cliente.cnpj = documentDigits;
    payload.cliente.contato = {
      nome: String(form.representativeName || "").trim(),
      email: String(form.representativeEmail || "").trim(),
      telefone: String(form.representativePhone || "").trim(),
      dataNascimento: formatBirthDateForPayload(form.representativeBirthDate),
      cpf: normalizeDocumentDigits(form.representativeDocument),
    };
  } else {
    payload.cliente.cpf = documentDigits;
    payload.cliente.dataNascimento = formatBirthDateForPayload(
      form.customerBirthDate,
    );
  }

  return payload;
}

function applyCertificateCustomerLookup(current, customer) {
  const isCompany = customer.personType === "pj";
  return {
    ...current,
    personType: customer.personType || current.personType,
    customerName: customer.name || current.customerName,
    customerEmail: customer.email || current.customerEmail,
    customerPhone: customer.phone || current.customerPhone,
    customerBirthDate: isCompany
      ? current.customerBirthDate
      : customer.birthday || current.customerBirthDate,
    addressRaw: customer.address?.raw || current.addressRaw,
    cep: customer.address?.cep || current.cep,
    municipality: customer.address?.municipio || current.municipality,
    uf: customer.address?.uf || current.uf,
    neighborhood: customer.address?.bairro || current.neighborhood,
    number: customer.address?.numero || current.number,
    street: customer.address?.logradouro || current.street,
    representativeName:
      customer.representative?.name || current.representativeName,
    representativeDocument:
      customer.representative?.document || current.representativeDocument,
    representativePhone:
      customer.representative?.phone || current.representativePhone,
    representativeBirthDate: isCompany
      ? customer.representative?.birthDate || current.representativeBirthDate
      : current.representativeBirthDate,
    indicationDocument:
      customer.indication?.document || current.indicationDocument,
    indicationType: customer.indication?.type || current.indicationType,
    indicationRaw: customer.indication?.raw || current.indicationRaw,
  };
}

function normalizeSearchLabel(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function extractIndicationDocument(rawValue) {
  const match = String(rawValue || "").match(/\(([^)]+)\)/);
  return normalizeDocumentDigits(match?.[1] || "");
}

function applyCertificateOrderToForm(current, order, products = []) {
  const document = normalizeDocumentDigits(order?.document);
  const personType = isCompanyDocument(document) ? "pj" : "pf";
  const normalizedOrderProduct = normalizeSearchLabel(order?.productName);
  const indicationDocument = extractIndicationDocument(order?.indicationRaw);
  const matchedProduct =
    products.find(
      product =>
        normalizeSearchLabel(product?.productName) === normalizedOrderProduct,
    ) || null;

  return {
    ...current,
    document: document || current.document,
    personType,
    customerName: order?.customerName || current.customerName,
    customerEmail: order?.email || current.customerEmail,
    customerPhone: order?.phone || current.customerPhone,
    productSearch: order?.productName || current.productSearch,
    selectedProductKey: matchedProduct ? createProductKey(matchedProduct) : "",
    productCode: matchedProduct?.productCode
      ? String(matchedProduct.productCode)
      : current.productCode,
    productName: matchedProduct?.productName || order?.productName || current.productName,
    certificateValue:
      matchedProduct?.suggestedValue || current.certificateValue,
    indicationDocument: indicationDocument || current.indicationDocument,
    indicationType: indicationDocument
      ? indicationDocument.length > 11
        ? "cnpj"
        : "cpf"
      : current.indicationType,
    indicationRaw: order?.indicationRaw || current.indicationRaw,
  };
}

function getDefaultMobileDownloadUrl(apiUrl) {
  const targetApiUrl = normalizeApiUrl(apiUrl);
  return targetApiUrl ? `${targetApiUrl}/public/whaticket-mobile.apk` : "";
}

function mergePublicSettings(settings, apiUrl) {
  const mapped = mapSettingsArray(Array.isArray(settings) ? settings : []);

  return {
    ...DEFAULT_PUBLIC_SETTINGS,
    ...mapped,
    mobileAppDownloadUrl:
      String(mapped.mobileAppDownloadUrl || "").trim() ||
      getDefaultMobileDownloadUrl(apiUrl),
  };
}

function compareVersions(currentVersion, latestVersion) {
  const toParts = value =>
    String(value || "")
      .split(/[+-]/)[0]
      .split(".")
      .map(part => Number(String(part).replace(/\D/g, "")) || 0);

  const current = toParts(currentVersion);
  const latest = toParts(latestVersion);
  const size = Math.max(current.length, latest.length, 3);

  for (let index = 0; index < size; index += 1) {
    const currentPart = current[index] || 0;
    const latestPart = latest[index] || 0;

    if (currentPart < latestPart) {
      return -1;
    }

    if (currentPart > latestPart) {
      return 1;
    }
  }

  return 0;
}

function formatDateTime(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch (_error) {
    return String(value);
  }
}

function formatAudioTime(seconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
}

function isAudioMediaType(value) {
  const mediaType = String(value || "").trim().toLowerCase();
  return mediaType === "audio" || mediaType === "ptt";
}

function isImageMediaType(value) {
  return String(value || "").trim().toLowerCase() === "image";
}

function isVideoMediaType(value) {
  return String(value || "").trim().toLowerCase() === "video";
}

function isAudioFilename(value) {
  return /\.(ogg|opus|mp3|wav|m4a|aac|amr|webm)(\?.*)?$/i.test(
    String(value || "").trim(),
  );
}

function isImageFilename(value) {
  return /\.(jpe?g|png|gif|webp|bmp|heic|heif)(\?.*)?$/i.test(
    String(value || "").trim(),
  );
}

function isVideoFilename(value) {
  return /\.(mp4|mov|avi|mkv|webm|m4v)(\?.*)?$/i.test(
    String(value || "").trim(),
  );
}

function getMediaUrl(message) {
  return String(message?.mediaUrl || "").trim();
}

function isAudioMessage(message) {
  return (
    isAudioMediaType(message?.mediaType) ||
    isAudioFilename(message?.mediaUrl) ||
    isAudioFilename(message?.body)
  );
}

function isImageMessage(message) {
  return (
    isImageMediaType(message?.mediaType) ||
    isImageFilename(message?.mediaUrl) ||
    isImageFilename(message?.body)
  );
}

function isVideoMessage(message) {
  return (
    isVideoMediaType(message?.mediaType) ||
    isVideoFilename(message?.mediaUrl) ||
    isVideoFilename(message?.body)
  );
}

function hasMediaAttachment(message) {
  return Boolean(getMediaUrl(message));
}

function getFileNameFromUrl(value) {
  const rawValue = String(value || "").trim();

  if (!rawValue) {
    return "";
  }

  try {
    const parsed = new URL(rawValue);
    return decodeURIComponent(parsed.pathname.split("/").pop() || "");
  } catch (_error) {
    return decodeURIComponent(rawValue.split("?")[0].split("/").pop() || "");
  }
}

function getMessageFileName(message) {
  return (
    getFileNameFromUrl(message?.mediaUrl) ||
    getFileNameFromUrl(message?.body) ||
    ""
  );
}

function isGeneratedMediaBody(message, text) {
  if (!text || !hasMediaAttachment(message)) {
    return false;
  }

  const mediaFileName = getMessageFileName(message);

  if (mediaFileName && text === mediaFileName) {
    return true;
  }

  if (isAudioMessage(message) && isAudioFilename(text)) {
    return true;
  }

  if (isImageMessage(message) && isImageFilename(text)) {
    return true;
  }

  if (isVideoMessage(message) && isVideoFilename(text)) {
    return true;
  }

  return false;
}

function getMessageBodyText(message) {
  const text = String(message?.body || "").trim();

  if (!text) {
    return "";
  }

  if (isGeneratedMediaBody(message, text)) {
    return "";
  }

  return text;
}

function getFileMimeType(filename) {
  const extension = String(filename || "")
    .trim()
    .toLowerCase()
    .split(".")
    .pop();

  switch (extension) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "heic":
      return "image/heic";
    case "heif":
      return "image/heif";
    case "pdf":
      return "application/pdf";
    case "ogg":
    case "oga":
      return "audio/ogg";
    case "opus":
      return "audio/ogg";
    case "mp3":
      return "audio/mpeg";
    case "wav":
      return "audio/wav";
    case "m4a":
      return "audio/mp4";
    case "aac":
      return "audio/aac";
    case "amr":
      return "audio/amr";
    case "mp4":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "m4v":
      return "video/x-m4v";
    case "webm":
      return "video/webm";
    default:
      return "application/octet-stream";
  }
}

function buildHeaders(token, extra = {}, options = {}) {
  const { includeJsonContentType = true } = options;
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };

  if (includeJsonContentType && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

async function apiFetch(apiUrl, path, options = {}, token) {
  const isFormDataBody =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  const response = await fetch(`${normalizeApiUrl(apiUrl)}${path}`, {
    ...options,
    headers: buildHeaders(token, options.headers || {}, {
      includeJsonContentType: !isFormDataBody,
    }),
  });

  const isJson = String(response.headers.get("content-type") || "").includes(
    "application/json",
  );
  const payload = isJson ? await response.json().catch(() => ({})) : null;

  if (!response.ok) {
    const errorMessage =
      payload?.error ||
      payload?.message ||
      payload?.details ||
      `Falha na requisição (${response.status}).`;
    throw new Error(errorMessage);
  }

  return payload;
}

async function fetchTicketsFromStoredSession() {
  const storedAuth = await getStoredJson(AUTH_STORAGE_KEY);

  if (!storedAuth?.email || !storedAuth?.password) {
    return [];
  }

  const apiUrl = normalizeApiUrl(storedAuth.apiUrl || defaultApiUrl);
  const session = await apiFetch(apiUrl, "/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: storedAuth.email,
      password: storedAuth.password,
    }),
  });

  const payload = await apiFetch(
    apiUrl,
    "/tickets?pageNumber=1&showAll=true",
    {},
    session.token,
  );

  return payload.tickets || [];
}

async function runBackgroundTicketSync(notify = true) {
  try {
    const tickets = await fetchTicketsFromStoredSession();
    await syncTicketNotifications(tickets, notify);
    return true;
  } catch (_error) {
    return false;
  }
}

function uniqueIds(items = []) {
  return Array.from(
    new Set(
      items
        .map(item => Number(item))
        .filter(item => Number.isFinite(item) && item > 0),
    ),
  );
}

function toggleId(list, id) {
  return list.includes(id) ? list.filter(item => item !== id) : [...list, id];
}

function isPrincipalPipeline(pipeline) {
  return String(pipeline?.name || "").trim().toLowerCase() === "pipeline principal";
}

function getPrincipalPipeline(pipelines = []) {
  return pipelines.find(isPrincipalPipeline) || pipelines[0] || null;
}

function StatusBadge({ status }) {
  const tone =
    status === "open"
      ? styles.statusOpen
      : status === "pending"
        ? styles.statusPending
        : styles.statusClosed;

  return (
    <View style={[styles.statusBadge, tone]}>
      <Text style={styles.statusBadgeText}>{status || "sem status"}</Text>
    </View>
  );
}

function Badge({ label, color, filled = false }) {
  return (
    <View
      style={[
        styles.badge,
        filled
          ? { backgroundColor: color || "#3f51b5" }
          : { borderColor: color || "#cbd5e1", backgroundColor: "#f8fafc" },
      ]}
    >
      <Text style={[styles.badgeText, filled && styles.badgeTextFilled]}>
        {label}
      </Text>
    </View>
  );
}

function ContactAvatar({ contact, size = 44 }) {
  const imageUrl = String(contact?.profilePicUrl || "").trim();
  const fallbackText = String(contact?.name || contact?.number || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <View
      style={[
        styles.avatarShell,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <Text style={styles.avatarFallbackText}>{fallbackText || "?"}</Text>
      )}
    </View>
  );
}

function AudioMessagePlayer({ message, fromMe = false }) {
  const audioUrl = String(message?.mediaUrl || "").trim();
  const player = useAudioPlayer(audioUrl || null, {
    downloadFirst: true,
    updateInterval: 250,
  });
  const status = useAudioPlayerStatus(player);
  const duration = Number(status?.duration || 0);
  const currentTime = Number(
    status?.didJustFinish ? duration : status?.currentTime || 0,
  );
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const isBusy = !status?.isLoaded || status?.isBuffering;

  async function handleTogglePlayback() {
    if (!audioUrl) {
      return;
    }

    if (status?.playing) {
      player.pause();
      return;
    }

    if (status?.didJustFinish || (duration > 0 && currentTime >= duration - 0.25)) {
      try {
        await player.seekTo(0);
      } catch (_error) {}
    }

    player.play();
  }

  return (
    <View style={[styles.audioCard, fromMe && styles.audioCardMine]}>
      <View style={styles.audioCardTop}>
        <Pressable
          onPress={handleTogglePlayback}
          disabled={!audioUrl}
          style={[styles.audioButton, fromMe && styles.audioButtonMine]}
        >
          <Text
            style={[
              styles.audioButtonText,
              fromMe && styles.audioButtonTextMine,
            ]}
          >
            {status?.playing ? "Pausar" : "Ouvir"}
          </Text>
        </Pressable>

        <Text
          style={[
            styles.audioMetaText,
            fromMe && styles.audioMetaTextMine,
          ]}
        >
          {!audioUrl
            ? "Audio indisponivel"
            : isBusy
            ? "Carregando..."
            : `${formatAudioTime(currentTime)} / ${formatAudioTime(duration)}`}
        </Text>
      </View>

      <View style={[styles.audioProgressTrack, fromMe && styles.audioProgressTrackMine]}>
        <View
          style={[
            styles.audioProgressFill,
            fromMe && styles.audioProgressFillMine,
            { width: `${audioUrl ? Math.max(6, progress * 100) : 0}%` },
          ]}
        />
      </View>
    </View>
  );
}

function MediaMessageContent({ message, fromMe = false }) {
  const mediaUrl = getMediaUrl(message);
  const fileName = getMessageFileName(message) || "Arquivo";

  if (!mediaUrl) {
    return null;
  }

  if (isAudioMessage(message)) {
    return <AudioMessagePlayer message={message} fromMe={fromMe} />;
  }

  if (isImageMessage(message)) {
    return (
      <Pressable onPress={() => Linking.openURL(mediaUrl)} style={styles.mediaImageShell}>
        <Image
          source={{ uri: mediaUrl }}
          style={styles.mediaImage}
          resizeMode="cover"
        />
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => Linking.openURL(mediaUrl)}
      style={[styles.mediaFileCard, fromMe && styles.mediaFileCardMine]}
    >
      <Text
        style={[styles.mediaFileName, fromMe && styles.mediaFileNameMine]}
        numberOfLines={1}
      >
        {fileName}
      </Text>
      <Text style={[styles.mediaFileAction, fromMe && styles.mediaFileActionMine]}>
        {isVideoMessage(message) ? "Abrir video" : "Abrir arquivo"}
      </Text>
    </Pressable>
  );
}

function AppBrand({ title, logoUrl, size = 64 }) {
  const imageUrl = String(logoUrl || "").trim();
  const fallbackText = String(title || APP_NAME_FALLBACK)
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <View
      style={[
        styles.brandAvatarShell,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
        />
      ) : (
        <Text
          style={[
            styles.brandAvatarText,
            { fontSize: Math.max(20, Math.round(size * 0.38)) },
          ]}
        >
          {fallbackText || "W"}
        </Text>
      )}
    </View>
  );
}

function ActionButton({ label, onPress, primary = false }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.actionButton, primary && styles.actionButtonPrimary]}
    >
      <Text
        style={[
          styles.actionButtonText,
          primary && styles.actionButtonTextPrimary,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ComposerIconButton({
  label,
  icon,
  onPress,
  active = false,
  disabled = false,
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.composerIconButton,
        active && styles.composerIconButtonActive,
        disabled && styles.buttonDisabled,
      ]}
    >
      <Text
        style={[
          styles.composerIconGlyph,
          active && styles.composerIconGlyphActive,
        ]}
      >
        {icon}
      </Text>
      <Text
        style={[
          styles.composerIconLabel,
          active && styles.composerIconLabelActive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

if (!TaskManager.isTaskDefined(BACKGROUND_TASK_NAME)) {
  TaskManager.defineTask(BACKGROUND_TASK_NAME, async () => {
    const ok = await runBackgroundTicketSync(true);
    return ok
      ? BackgroundTask.BackgroundTaskResult.Success
      : BackgroundTask.BackgroundTaskResult.Failed;
  });
}

function UpdateNotice({
  visible,
  currentVersion,
  latestVersion,
  onPress,
}) {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.updateNotice}>
      <Text style={styles.updateNoticeTitle}>Atualização disponível</Text>
      <Text style={styles.updateNoticeText}>
        Versão atual {currentVersion} • última versão {latestVersion}
      </Text>
      <ActionButton label="Atualizar app" primary onPress={onPress} />
    </View>
  );
}

function LoginScreen({
  appName,
  appLogoUrl,
  apiUrl,
  email,
  password,
  loading,
  error,
  currentVersion,
  latestVersion,
  updateAvailable,
  onUpdatePress,
  onChangeApiUrl,
  onChangeEmail,
  onChangePassword,
  onSubmit,
}) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor="transparent"
        translucent
      />
      <KeyboardAvoidingView
        style={[
          styles.loginShell,
          {
            paddingTop: Math.max(insets.top, 16),
            paddingBottom: Math.max(insets.bottom, 24),
          },
        ]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 12}
      >
        <AppBrand title={appName} logoUrl={appLogoUrl} size={76} />

        <View style={styles.card}>
          <Text style={styles.loginTitle}>{appName || APP_NAME_FALLBACK}</Text>
          <Text style={styles.loginSubtitle}>
            Login do mesmo backend usado no painel web.
          </Text>
          <Text style={styles.helperText}>Versão do app: {currentVersion}</Text>

          <UpdateNotice
            visible={updateAvailable}
            currentVersion={currentVersion}
            latestVersion={latestVersion}
            onPress={onUpdatePress}
          />

          <TextInput
            style={styles.input}
            placeholder="URL da API"
            autoCapitalize="none"
            value={apiUrl}
            onChangeText={onChangeApiUrl}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={onChangeEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Senha"
            secureTextEntry
            value={password}
            onChangeText={onChangePassword}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            onPress={onSubmit}
            disabled={loading}
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>Entrar</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MainShell({
  title,
  subtitle,
  logoUrl,
  sections,
  section,
  onChangeSection,
  onLogout,
  children,
}) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <View
        style={[
          styles.appBar,
          {
            paddingTop: Math.max(insets.top, 12) + 6,
          },
        ]}
      >
        <AppBrand title={title} logoUrl={logoUrl} size={42} />
        <View style={styles.flexOne}>
          <Text style={styles.appBarTitle}>{title}</Text>
          <Text style={styles.appBarSubtitle}>{subtitle}</Text>
        </View>
        <ActionButton label="Sair" onPress={onLogout} />
      </View>

      <View style={styles.content}>{children}</View>

      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}
      >
        {sections.map(item => (
          <Pressable
            key={item.key}
            onPress={() => onChangeSection(item.key)}
            style={[
              styles.bottomTab,
              section === item.key && styles.bottomTabActive,
            ]}
          >
            <Text
              style={[
                styles.bottomTabText,
                section === item.key && styles.bottomTabTextActive,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

function TicketCard({ ticket, onPress, certificateSummary = null }) {
  return (
    <Pressable onPress={onPress} style={styles.ticketCard}>
      <View style={styles.ticketTop}>
        <View style={styles.ticketIdentity}>
          <ContactAvatar contact={ticket.contact} size={42} />
          <View style={styles.flexOne}>
            <Text style={styles.ticketName} numberOfLines={1}>
              {ticket.contact?.name || ticket.contact?.number || `#${ticket.id}`}
            </Text>
            <Text style={styles.ticketMeta}>
              #{ticket.id} • {ticket.user?.name || "Sem responsavel"}
            </Text>
          </View>
        </View>
        <StatusBadge status={ticket.status} />
      </View>
      <Text style={styles.ticketMeta}>
        {ticket.queue?.name || "Sem fila"} •{" "}
        {ticket.pipeline?.name || "Kanban principal"}
      </Text>
      <Text style={styles.ticketSnippet} numberOfLines={2}>
        {ticket.lastMessage || "Sem mensagens"}
      </Text>

      <View style={styles.ticketBottom}>
        <Text style={styles.timeText}>{formatDateTime(ticket.updatedAt)}</Text>
        {!!ticket.unreadMessages && (
          <Badge label={String(ticket.unreadMessages)} color="#3f51b5" filled />
        )}
      </View>

      <View style={styles.badgesWrap}>
        {(ticket.tags || []).map(tag => (
          <Badge
            key={tag.id}
            label={tag.name}
            color={tag.color || "#64748b"}
          />
        ))}
        {certificateSummary?.protocol ? (
          <Badge
            label={`Protocolo ${certificateSummary.protocol}`}
            color="#3f51b5"
          />
        ) : null}
        <CertificatePaymentStatusBadge
          paymentStatus={certificateSummary?.paymentStatus}
        />
        <CertificateDeliveryStatusBadge
          paymentSentStatus={certificateSummary?.paymentSentStatus}
          serviceSentStatus={certificateSummary?.serviceSentStatus}
          approvalSentStatus={certificateSummary?.approvalSentStatus}
        />
      </View>
    </Pressable>
  );
}

function ContactPipelineCard({ membership, onPress }) {
  const contact = membership?.contact || null;

  return (
    <Pressable onPress={onPress} style={styles.ticketCard}>
      <View style={styles.ticketTop}>
        <View style={styles.ticketIdentity}>
          <ContactAvatar contact={contact} size={42} />
          <View style={styles.flexOne}>
            <Text style={styles.ticketName} numberOfLines={1}>
              {contact?.name || contact?.number || `Contato #${membership?.contactId || ""}`}
            </Text>
            <Text style={styles.ticketMeta}>
              {contact?.number || "Sem numero"}
            </Text>
          </View>
        </View>
        <Badge
          label={membership?.kanbanStage?.name || "Sem etapa"}
          color={membership?.kanbanStage?.color || membership?.pipeline?.color || "#3f51b5"}
          filled
        />
      </View>

      <Text style={styles.ticketMeta}>
        {membership?.pipeline?.name || "Pipeline"} • contato #{membership?.contactId || "-"}
      </Text>

      <View style={styles.ticketBottom}>
        <Text style={styles.timeText}>{formatDateTime(membership?.updatedAt)}</Text>
      </View>

      <View style={styles.badgesWrap}>
        {((contact?.tags || [])).map(tag => (
          <Badge
            key={tag.id}
            label={tag.name}
            color={tag.color || "#64748b"}
          />
        ))}
      </View>
    </Pressable>
  );
}

function TicketsHomeScreen({
  view,
  search,
  tickets,
  inboxCertificateSummaries,
  loading,
  error,
  pipelines,
  selectedKanbanPipelineId,
  kanbanTickets,
  kanbanMemberships,
  kanbanLoading,
  kanbanError,
  onChangeView,
  onChangeSearch,
  onChangeKanbanPipeline,
  onRefreshTickets,
  onRefreshKanban,
  onOpenTicket,
  onOpenContact,
}) {
  const selectedKanbanPipeline =
    pipelines.find(item => String(item.id) === String(selectedKanbanPipelineId)) ||
    getPrincipalPipeline(pipelines);
  const kanbanColumns = isPrincipalPipeline(selectedKanbanPipeline)
    ? principalKanbanColumns
    : selectedKanbanPipeline?.stages || [];

  return (
    <View style={styles.flexOne}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.topTabs,
          view === "kanban" && styles.topTabsCompactShell,
        ]}
      >
        {ticketViews.map(item => (
          <Pressable
            key={item.key}
            onPress={() => onChangeView(item.key)}
            style={[
              styles.topTab,
              view === "kanban" && styles.topTabCompact,
              view === item.key && styles.topTabActive,
            ]}
          >
            <Text
              style={[
                styles.topTabText,
                view === "kanban" && styles.topTabTextCompact,
                view === item.key && styles.topTabTextActive,
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {view !== "kanban" ? (
        <ScrollView contentContainerStyle={styles.screenContent}>
          <View style={styles.card}>
            <TextInput
              style={styles.input}
              placeholder="Buscar ticket, contato ou mensagem"
              value={search}
              onChangeText={onChangeSearch}
            />
            <View style={styles.toolbar}>
              <Text style={styles.toolbarText}>{tickets.length} ticket(s)</Text>
              <ActionButton label="Atualizar" onPress={onRefreshTickets} />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color="#3f51b5" />
            </View>
          ) : tickets.length ? (
            tickets.map(ticket => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                certificateSummary={
                  inboxCertificateSummaries[String(ticket.contact?.id || "")]
                }
                onPress={() => onOpenTicket(ticket)}
              />
            ))
          ) : (
            <View style={styles.card}>
              <Text style={styles.emptyTitle}>Nada aqui</Text>
              <Text style={styles.emptyText}>Nenhum ticket nesse filtro.</Text>
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.screenContent}>
          <View style={styles.card}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.topTabsCompact}
            >
              {pipelines.map(pipeline => (
                <Pressable
                  key={pipeline.id}
                  onPress={() => onChangeKanbanPipeline(pipeline.id)}
                  style={[
                    styles.topTab,
                    String(selectedKanbanPipeline?.id || "") === String(pipeline.id) &&
                      styles.topTabActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.topTabText,
                      String(selectedKanbanPipeline?.id || "") === String(pipeline.id) &&
                        styles.topTabTextActive,
                    ]}
                  >
                    {pipeline.name}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={styles.toolbar}>
              <Text style={styles.toolbarText}>
                {selectedKanbanPipeline?.name || "Kanban"}
              </Text>
              <ActionButton label="Atualizar" onPress={onRefreshKanban} />
            </View>
            <Text style={styles.helperText}>
              {isPrincipalPipeline(selectedKanbanPipeline)
                ? "Kanban da situacao do ticket: aguardando, em atendimento e resolvido."
                : "Este kanban paralelo organiza contatos por etapa, sem mexer no ticket principal."}
            </Text>
            {kanbanError ? <Text style={styles.errorText}>{kanbanError}</Text> : null}
          </View>

          {kanbanLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color="#3f51b5" />
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.kanbanRow}>
                {kanbanColumns.map(stage => {
                  const stageItems = isPrincipalPipeline(selectedKanbanPipeline)
                    ? kanbanTickets.filter(
                        ticket => String(ticket.status) === String(stage.id),
                      )
                    : kanbanMemberships.filter(
                        membership =>
                          String(membership.kanbanStageId) === String(stage.id),
                      );

                  return (
                    <View key={stage.id} style={styles.kanbanColumn}>
                      <View
                        style={[
                          styles.kanbanHeader,
                          { backgroundColor: stage.color },
                        ]}
                      >
                        <Text style={styles.kanbanHeaderText}>
                          {stage.title || stage.name}
                        </Text>
                        <Text style={styles.kanbanHeaderCount}>
                          {stageItems.length}
                        </Text>
                      </View>

                      {stageItems.length ? (
                        stageItems.map(item =>
                          isPrincipalPipeline(selectedKanbanPipeline) ? (
                            <TicketCard
                              key={item.id}
                              ticket={item}
                              certificateSummary={
                                inboxCertificateSummaries[
                                  String(item.contact?.id || "")
                                ]
                              }
                              onPress={() => onOpenTicket(item)}
                            />
                          ) : (
                            <ContactPipelineCard
                              key={`${item.contactId}-${item.pipelineId}`}
                              membership={item}
                              onPress={() => onOpenContact(item.contact)}
                            />
                          ),
                        )
                      ) : (
                        <View style={styles.card}>
                          <Text style={styles.emptyText}>
                            {isPrincipalPipeline(selectedKanbanPipeline)
                              ? "Sem tickets."
                              : "Sem contatos."}
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function ContactsScreen({
  search,
  contacts,
  loading,
  error,
  onChangeSearch,
  onRefresh,
  onOpenContact,
}) {
  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <View style={styles.card}>
        <TextInput
          style={styles.input}
          placeholder="Buscar contato"
          value={search}
          onChangeText={onChangeSearch}
        />
        <View style={styles.toolbar}>
          <Text style={styles.toolbarText}>{contacts.length} contato(s)</Text>
          <ActionButton label="Atualizar" onPress={onRefresh} />
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#3f51b5" />
        </View>
      ) : contacts.length ? (
        contacts.map(contact => (
          <Pressable
            key={contact.id}
            onPress={() => onOpenContact(contact)}
            style={styles.contactCard}
          >
            <View style={styles.ticketIdentity}>
              <ContactAvatar contact={contact} size={42} />
              <View style={styles.flexOne}>
                <Text style={styles.ticketName}>
                  {contact.name || contact.number || `#${contact.id}`}
                </Text>
                <Text style={styles.ticketMeta}>
                  {contact.number || "Sem numero"}
                </Text>
              </View>
            </View>
          </Pressable>
        ))
      ) : (
        <View style={styles.card}>
          <Text style={styles.emptyTitle}>Nada aqui</Text>
          <Text style={styles.emptyText}>Nenhum contato encontrado.</Text>
        </View>
      )}
    </ScrollView>
  );
}

function CertificateStatusBadge({ status }) {
  const normalized = String(status || "Sem status").toLowerCase();
  const isApproved = normalized.includes("aprov");
  const isPending = normalized.includes("aguard");
  const style = isApproved
    ? styles.certStatusApproved
    : isPending
      ? styles.certStatusPending
      : styles.certStatusOther;

  return (
    <View style={[styles.certStatusBadge, style]}>
      <Text style={styles.certStatusBadgeText}>{status || "Sem status"}</Text>
    </View>
  );
}

function CertificatePaymentStatusBadge({ paymentStatus }) {
  const normalized = String(paymentStatus || "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized.includes("a receber")) {
    return <Badge label="🕒 A receber" color="#f59e0b" filled />;
  }

  if (normalized.includes("conciliad")) {
    return <Badge label="🟢 Conciliado" color="#16a34a" filled />;
  }

  return null;
}

function CertificateDeliveryStatusBadge({
  paymentSentStatus,
  serviceSentStatus,
  approvalSentStatus,
}) {
  const normalizedPayment = String(paymentSentStatus || "").trim().toLowerCase();
  const normalizedService = String(serviceSentStatus || "").trim().toLowerCase();
  const normalizedApproval = String(approvalSentStatus || "").trim().toLowerCase();

  if (normalizedApproval === "sim") {
    return <Badge label="🟢 Aprovação enviada" color="#16a34a" filled />;
  }

  if (normalizedApproval.includes("erro")) {
    return <Badge label="✖ Erro ao enviar a aprovação" color="#b91c1c" filled />;
  }

  if (normalizedService === "sim") {
    return <Badge label="🟢 Atendimento enviado" color="#16a34a" filled />;
  }

  if (normalizedService.includes("erro")) {
    return <Badge label="✖ Erro ao enviar o atendimento" color="#b91c1c" filled />;
  }

  if (normalizedPayment === "sim") {
    return <Badge label="🟢 Pagamento enviado" color="#16a34a" filled />;
  }

  if (normalizedPayment.includes("erro")) {
    return <Badge label="✖ Erro ao enviar o pagamento" color="#b91c1c" filled />;
  }

  return null;
}

function buildTicketCertificateSummary(order) {
  if (!order) {
    return null;
  }

  return {
    identifier: order.identifier || "",
    protocol: order.protocol || "",
    paymentStatus: order.paymentStatus || "",
    paymentSentStatus: order.paymentSentStatus || "",
    serviceSentStatus: order.serviceSentStatus || "",
    approvalSentStatus: order.approvalSentStatus || "",
  };
}

function CertificateOrderCard({ order }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable onPress={() => setExpanded(current => !current)} style={styles.ticketCard}>
      <View style={styles.ticketTop}>
        <View style={styles.flexOne}>
          <Text style={styles.ticketName} numberOfLines={1}>
            {order.customerName || "Sem nome"} #{order.identifier}
          </Text>
          <Text style={styles.ticketMeta}>
            {order.productName || "Produto não informado"}
          </Text>
        </View>
        <CertificateStatusBadge status={order.status} />
      </View>

      <View style={styles.badgesWrap}>
        {order.protocol ? (
          <Badge label={`Protocolo ${order.protocol}`} color="#3f51b5" />
        ) : null}
        <CertificatePaymentStatusBadge paymentStatus={order.paymentStatus} />
        <CertificateDeliveryStatusBadge
          paymentSentStatus={order.paymentSentStatus}
          serviceSentStatus={order.serviceSentStatus}
          approvalSentStatus={order.approvalSentStatus}
        />
      </View>

      <Text style={styles.ticketMeta}>
        {order.dateLabel || "-"} • {order.vendor || "Sem vendedor"}
      </Text>

      {expanded ? (
        <View style={styles.orderDetailSection}>
          <Text style={styles.helperText}>Documento: {order.document || "-"}</Text>
          <Text style={styles.helperText}>Telefone: {order.phone || "-"}</Text>
          <Text style={styles.helperText}>Email: {order.email || "-"}</Text>
          <Text style={styles.helperText}>Contabilidade: {order.accounting || "-"}</Text>
          <Text style={styles.helperText}>Unidade: {order.unitName || order.unitCode || "-"}</Text>
          <Text style={styles.helperText}>Aprovação: {order.approvalDate || "-"}</Text>
          <Text style={styles.helperText}>Indicação: {order.indicationRaw || "-"}</Text>
          <Text style={styles.helperText}>Stage: {order.stage || "-"}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function CertificateChatMessage({ message }) {
  const isAssistant = message.role === "assistant";

  return (
    <View
      style={[
        styles.chatBubble,
        isAssistant ? styles.chatBubbleAssistant : styles.chatBubbleUser,
      ]}
    >
      <Text style={styles.chatBubbleRole}>
        {isAssistant ? "Agente" : "Você"}
      </Text>
      <Text style={styles.chatBubbleText}>{message.content || ""}</Text>
      {Array.isArray(message.attachments) && message.attachments.length ? (
        <View style={styles.attachmentPillRow}>
          {message.attachments.map((attachment, index) => (
            <View
              key={`${attachment}-${index}`}
              style={styles.attachmentPill}
            >
              <Text style={styles.attachmentPillText}>{attachment}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {Array.isArray(message.trace) && message.trace.length ? (
        <View style={styles.chatTrace}>
          {message.trace.map((item, index) => (
            <Text key={`${item.tool}-${index}`} style={styles.chatTraceText}>
              {item.tool}: {item.result?.ok === false ? "erro" : "ok"}
            </Text>
          ))}
        </View>
      ) : null}
      {message.logId ? (
        <Text style={styles.chatTraceText}>log #{message.logId}</Text>
      ) : null}
    </View>
  );
}

function CertificateProductSelector({
  open,
  onToggle,
  products,
  loading,
  search,
  onSearchChange,
  selectedProductKey,
  onSelect,
}) {
  const selectedProduct =
    products.find(item => createProductKey(item) === selectedProductKey) || null;
  const filteredProducts = products.filter(item => {
    if (!search.trim()) {
      return true;
    }

    const term = search.trim().toLowerCase();
    return (
      String(item.productCode || "").toLowerCase().includes(term) ||
      String(item.productName || "").toLowerCase().includes(term)
    );
  });

  return (
    <View style={styles.card}>
      <Pressable style={styles.selectorHeader} onPress={onToggle}>
        <View style={styles.flexOne}>
          <Text style={styles.sectionTitle}>Produto</Text>
          <Text style={styles.helperText}>
            {selectedProduct
              ? `${selectedProduct.productName} (${selectedProduct.orderCount} pedidos)`
              : "Selecione um produto recorrente"}
          </Text>
        </View>
        <ActionButton label={open ? "Fechar" : "Escolher"} onPress={onToggle} />
      </Pressable>

      {open ? (
        <View style={styles.selectorBody}>
          <TextInput
            style={styles.input}
            placeholder="Buscar produto ou código"
            value={search}
            onChangeText={onSearchChange}
          />
          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color="#3f51b5" />
            </View>
          ) : null}
          <ScrollView style={styles.selectorList} nestedScrollEnabled>
            {filteredProducts.map(product => {
              const active = createProductKey(product) === selectedProductKey;
              return (
                <Pressable
                  key={createProductKey(product)}
                  onPress={() => onSelect(product)}
                  style={[
                    styles.selectorOption,
                    active && styles.selectorOptionActive,
                  ]}
                >
                  <Text style={styles.modalOptionTitle}>{product.productName}</Text>
                  <Text style={styles.modalOptionText}>
                    Código {product.productCode || "-"} • {product.orderCount} pedidos
                  </Text>
                  {product.suggestedValue ? (
                    <Text style={styles.modalOptionText}>
                      Valor sugerido: {product.suggestedValue}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
            {!filteredProducts.length && !loading ? (
              <Text style={styles.emptyText}>Nenhum produto encontrado.</Text>
            ) : null}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}

function CertificatesOrdersScreen({
  search,
  onChangeSearch,
  onRefresh,
  orders,
  loading,
  error,
  dateRange,
  onChangeDateRange,
  pagination,
  onPrevPage,
  onNextPage,
}) {
  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <View style={styles.card}>
        <TextInput
          style={styles.input}
          placeholder="Buscar pedido, cliente ou documento"
          value={search}
          onChangeText={onChangeSearch}
        />
        <View style={styles.doubleInputRow}>
          <TextInput
            style={[styles.input, styles.doubleInput]}
            placeholder="Data inicial"
            value={dateRange.startDate}
            onChangeText={value =>
              onChangeDateRange(current => ({ ...current, startDate: value }))
            }
          />
          <TextInput
            style={[styles.input, styles.doubleInput]}
            placeholder="Data final"
            value={dateRange.endDate}
            onChangeText={value =>
              onChangeDateRange(current => ({ ...current, endDate: value }))
            }
          />
        </View>
        <View style={styles.toolbar}>
          <Text style={styles.toolbarText}>
            {pagination.total || 0} pedido(s)
          </Text>
          <ActionButton label="Atualizar" onPress={onRefresh} />
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color="#3f51b5" />
        </View>
      ) : orders.length ? (
        <>
          {orders.map(order => (
            <CertificateOrderCard
              key={`${order.identifier}-${order.protocol || ""}`}
              order={order}
            />
          ))}

          <View style={styles.card}>
            <View style={styles.toolbar}>
              <Text style={styles.toolbarText}>
                Página {pagination.page || 1} de {pagination.totalPages || 1}
              </Text>
              <View style={styles.actionsRow}>
                <ActionButton label="Anterior" onPress={onPrevPage} />
                <ActionButton label="Próxima" onPress={onNextPage} />
              </View>
            </View>
          </View>
        </>
      ) : (
        <View style={styles.card}>
          <Text style={styles.emptyTitle}>Nada aqui</Text>
          <Text style={styles.emptyText}>Nenhum pedido encontrado.</Text>
        </View>
      )}
    </ScrollView>
  );
}

function CertificatesCreateScreen({
  form,
  onChangeForm,
  error,
  customerLookupLoading,
  customerLookupSummary,
  onLookupCustomer,
  requestedPersonType,
  productSelectorOpen,
  onToggleProductSelector,
  products,
  productsLoading,
  selectedProduct,
  onSelectProduct,
  createLoading,
  createResponse,
  onSubmit,
}) {
  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Criar pedido</Text>
        <Text style={styles.helperText}>
          Preencha o documento, carregue o cliente da base e envie o pedido pelo mesmo backend do certificados.
        </Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Text style={styles.sectionLabel}>CPF ou CNPJ</Text>
        <View style={styles.toolbar}>
          <TextInput
            style={[styles.input, styles.flexOne, styles.inlineActionInput]}
            placeholder="Digite o CPF ou CNPJ"
            value={form.document}
            onChangeText={value => {
              const nextPersonType = isCompanyDocument(value) ? "pj" : "pf";
              onChangeForm(current => ({
                ...current,
                document: value,
                personType: nextPersonType,
                selectedProductKey:
                  current.personType !== nextPersonType ? "" : current.selectedProductKey,
                productCode: current.personType !== nextPersonType ? "" : current.productCode,
                productName: current.personType !== nextPersonType ? "" : current.productName,
                certificateValue:
                  current.personType !== nextPersonType ? "" : current.certificateValue,
              }));
            }}
          />
          <ActionButton label={customerLookupLoading ? "..." : "Buscar"} onPress={onLookupCustomer} />
        </View>

        <View style={styles.badgesWrap}>
          <Badge
            label={(requestedPersonType || form.personType) === "pj" ? "Pessoa Jurídica" : "Pessoa Física"}
            color="#3f51b5"
          />
          {customerLookupSummary ? (
            <Badge label={customerLookupSummary} color="#64748b" />
          ) : null}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Indicação</Text>
        <TextInput
          style={styles.input}
          placeholder="CPF ou CNPJ da indicação"
          value={form.indicationDocument}
          onChangeText={value =>
            onChangeForm(current => ({
              ...current,
              indicationDocument: value,
              indicationType: normalizeDocumentDigits(value).length > 11 ? "cnpj" : "cpf",
            }))
          }
        />
        {form.indicationRaw ? (
          <Text style={styles.helperText}>Última indicação encontrada: {form.indicationRaw}</Text>
        ) : null}
      </View>

      <CertificateProductSelector
        open={productSelectorOpen}
        onToggle={onToggleProductSelector}
        products={products}
        loading={productsLoading}
        search={form.productSearch}
        onSearchChange={value =>
          onChangeForm(current => ({ ...current, productSearch: value }))
        }
        selectedProductKey={form.selectedProductKey}
        onSelect={onSelectProduct}
      />

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Certificado</Text>
        <TextInput
          style={[
            styles.input,
            selectedProduct?.suggestedValue && styles.readonlyInput,
          ]}
          placeholder="Valor do certificado"
          editable={!selectedProduct?.suggestedValue}
          value={form.certificateValue}
          onChangeText={value =>
            onChangeForm(current => ({ ...current, certificateValue: value }))
          }
        />

        <Text style={styles.sectionLabel}>Forma de pagamento</Text>
        <View style={styles.actionsRow}>
          {CERTIFICATE_PAYMENT_OPTIONS.map(option => (
            <Pressable
              key={option.id}
              onPress={() =>
                onChangeForm(current => ({ ...current, paymentMethod: option.id }))
              }
              style={[
                styles.topTab,
                form.paymentMethod === option.id && styles.topTabActive,
              ]}
            >
              <Text
                style={[
                  styles.topTabText,
                  form.paymentMethod === option.id && styles.topTabTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Tipo de validação</Text>
        <View style={styles.actionsRow}>
          {CERTIFICATE_VALIDATION_OPTIONS.map(option => (
            <Pressable
              key={option.id}
              onPress={() =>
                onChangeForm(current => ({ ...current, validationType: option.id }))
              }
              style={[
                styles.topTab,
                form.validationType === option.id && styles.topTabActive,
              ]}
            >
              <Text
                style={[
                  styles.topTabText,
                  form.validationType === option.id && styles.topTabTextActive,
                ]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Cliente</Text>
        <TextInput
          style={styles.input}
          placeholder="Nome"
          value={form.customerName}
          onChangeText={value => onChangeForm(current => ({ ...current, customerName: value }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          autoCapitalize="none"
          value={form.customerEmail}
          onChangeText={value => onChangeForm(current => ({ ...current, customerEmail: value }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Telefone"
          value={form.customerPhone}
          onChangeText={value => onChangeForm(current => ({ ...current, customerPhone: value }))}
        />
        {form.personType === "pf" ? (
          <TextInput
            style={styles.input}
            placeholder="Nascimento DD/MM/YYYY"
            value={form.customerBirthDate}
            onChangeText={value => onChangeForm(current => ({ ...current, customerBirthDate: value }))}
          />
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Endereço</Text>
        <TextInput
          style={styles.input}
          placeholder="Endereço bruto"
          value={form.addressRaw}
          onChangeText={value => onChangeForm(current => ({ ...current, addressRaw: value }))}
        />
        <View style={styles.doubleInputRow}>
          <TextInput
            style={[styles.input, styles.doubleInput]}
            placeholder="CEP"
            value={form.cep}
            onChangeText={value => onChangeForm(current => ({ ...current, cep: value }))}
          />
          <TextInput
            style={[styles.input, styles.doubleInput]}
            placeholder="UF"
            value={form.uf}
            onChangeText={value => onChangeForm(current => ({ ...current, uf: value }))}
          />
        </View>
        <TextInput
          style={styles.input}
          placeholder="Município"
          value={form.municipality}
          onChangeText={value => onChangeForm(current => ({ ...current, municipality: value }))}
        />
        <TextInput
          style={styles.input}
          placeholder="Bairro"
          value={form.neighborhood}
          onChangeText={value => onChangeForm(current => ({ ...current, neighborhood: value }))}
        />
        <View style={styles.doubleInputRow}>
          <TextInput
            style={[styles.input, styles.streetInput]}
            placeholder="Logradouro"
            value={form.street}
            onChangeText={value => onChangeForm(current => ({ ...current, street: value }))}
          />
          <TextInput
            style={[styles.input, styles.numberInput]}
            placeholder="Número"
            value={form.number}
            onChangeText={value => onChangeForm(current => ({ ...current, number: value }))}
          />
        </View>
      </View>

      {form.personType === "pj" ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Representante legal</Text>
          <TextInput
            style={styles.input}
            placeholder="Nome"
            value={form.representativeName}
            onChangeText={value => onChangeForm(current => ({ ...current, representativeName: value }))}
          />
          <TextInput
            style={styles.input}
            placeholder="CPF"
            value={form.representativeDocument}
            onChangeText={value => onChangeForm(current => ({ ...current, representativeDocument: value }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Telefone"
            value={form.representativePhone}
            onChangeText={value => onChangeForm(current => ({ ...current, representativePhone: value }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Email"
            autoCapitalize="none"
            value={form.representativeEmail}
            onChangeText={value => onChangeForm(current => ({ ...current, representativeEmail: value }))}
          />
          <TextInput
            style={styles.input}
            placeholder="Nascimento DD/MM/YYYY"
            value={form.representativeBirthDate}
            onChangeText={value => onChangeForm(current => ({ ...current, representativeBirthDate: value }))}
          />
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.actionsRow}>
          <ActionButton
            label="Limpar"
            onPress={() => onChangeForm(() => ({ ...EMPTY_CERTIFICATE_CREATE_FORM }))}
          />
          <ActionButton
            label={createLoading ? "Enviando..." : "Enviar pedido"}
            primary
            onPress={onSubmit}
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Retorno da última criação</Text>
        <Text style={styles.helperText}>
          {createResponse || "Nenhuma criação enviada nesta sessão."}
        </Text>
      </View>
    </ScrollView>
  );
}

function CertificatesChatScreen({
  messages,
  attachments,
  loading,
  error,
  input,
  onChangeInput,
  onSend,
  onPickPdf,
  onPickImage,
  onPickAudio,
  onToggleRecording,
  recording,
  onRemoveAttachment,
  onClear,
  showRealtime,
  onToggleRealtime,
  realtimeWebViewRef,
  onRealtimeMessage,
  onRealtimeError,
}) {
  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Chat de pedidos</Text>
        <Text style={styles.helperText}>
          Envie texto, PDF, imagem ou áudio. O agente consulta a base e cria o pedido pelo mesmo fluxo da tela de criação.
        </Text>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.chatMessages}>
          {messages.map((message, index) => (
            <CertificateChatMessage
              key={`${message.role}-${index}-${message.content}`}
              message={message}
            />
          ))}
          {loading ? <ActivityIndicator color="#3f51b5" /> : null}
        </View>

        {attachments.length ? (
          <View style={styles.attachmentPillRow}>
            {attachments.map((attachment, index) => (
              <Pressable
                key={`${attachment.uri}-${index}`}
                style={styles.attachmentPill}
                onPress={() => onRemoveAttachment(index)}
              >
                <Text style={styles.attachmentPillText}>
                  {attachment.name} ×
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={styles.actionsRow}>
          <ActionButton label="PDF" onPress={onPickPdf} />
          <ActionButton label="Imagem" onPress={onPickImage} />
          <ActionButton label="Áudio" onPress={onPickAudio} />
          <ActionButton
            label={recording ? "Parar áudio" : "Gravar áudio"}
            onPress={onToggleRecording}
            primary={recording}
          />
          <ActionButton label="Limpar" onPress={onClear} />
        </View>

        <TextInput
          multiline
          placeholder="Ex.: segue a CNH do cliente. Quero fazer um PF A1."
          value={input}
          onChangeText={onChangeInput}
          style={[styles.input, styles.chatComposer]}
        />

        <Pressable
          style={[styles.actionButton, styles.actionButtonPrimary]}
          onPress={onSend}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
              Enviar
            </Text>
          )}
        </Pressable>

        {showRealtime ? (
          <View style={styles.chatRealtimePanel}>
            <Text style={styles.sectionLabel}>Modo ao vivo</Text>
            <View style={styles.realtimeWebviewCardInline}>
              <WebView
                ref={realtimeWebViewRef}
                source={{
                  html: CERTIFICATE_REALTIME_WEBVIEW_HTML,
                  baseUrl: "https://app.local/",
                }}
                style={styles.realtimeWebview}
                mediaPlaybackRequiresUserAction={false}
                allowsInlineMediaPlayback
                mediaCapturePermissionGrantType="grant"
                javaScriptEnabled
                cacheEnabled={false}
                originWhitelist={["*"]}
                onMessage={onRealtimeMessage}
                onError={onRealtimeError}
              />
            </View>
          </View>
        ) : null}

        <View style={styles.chatActionRail}>
          <Pressable
            style={[
              styles.chatFabButton,
              recording && styles.chatFabButtonActive,
            ]}
            onPress={onToggleRecording}
          >
            <Text
              style={[
                styles.chatFabButtonText,
                recording && styles.chatFabButtonTextActive,
              ]}
            >
              Mic
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.chatFabButton,
              showRealtime && styles.chatFabButtonActive,
            ]}
            onPress={onToggleRealtime}
          >
            <Text
              style={[
                styles.chatFabButtonText,
                showRealtime && styles.chatFabButtonTextActive,
              ]}
            >
              Ao vivo
            </Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function ConfigScreen({
  appName,
  appLogoUrl,
  currentVersion,
  latestVersion,
  updateAvailable,
  downloadUrl,
  isAdmin,
  values,
  loading,
  saving,
  error,
  onChangeValue,
  onSave,
  onOpenUpdate,
  onRefresh,
}) {
  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <View style={styles.card}>
        <View style={styles.configPreview}>
          <AppBrand title={appName} logoUrl={appLogoUrl} size={68} />
          <View style={styles.flexOne}>
            <Text style={styles.sectionTitle}>{appName || APP_NAME_FALLBACK}</Text>
            <Text style={styles.helperText}>Versão instalada: {currentVersion}</Text>
            <Text style={styles.helperText}>Última versão: {latestVersion}</Text>
          </View>
        </View>

        <UpdateNotice
          visible={updateAvailable}
          currentVersion={currentVersion}
          latestVersion={latestVersion}
          onPress={onOpenUpdate}
        />

        <View style={styles.actionsRow}>
          <ActionButton label="Recarregar" onPress={onRefresh} />
          <ActionButton
            label="Baixar atualização"
            primary
            onPress={onOpenUpdate}
          />
        </View>

        {!downloadUrl ? (
          <Text style={styles.helperText}>
            Configure a URL de atualização para liberar o download do APK.
          </Text>
        ) : null}
      </View>

      {isAdmin ? (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Configurações públicas</Text>
          <TextInput
            style={styles.input}
            placeholder="Nome do aplicativo"
            value={values.appName}
            onChangeText={value => onChangeValue("appName", value)}
          />
          <TextInput
            style={styles.input}
            placeholder="URL da logo"
            autoCapitalize="none"
            value={values.appLogoUrl}
            onChangeText={value => onChangeValue("appLogoUrl", value)}
          />
          <TextInput
            style={styles.input}
            placeholder="Última versão do app"
            autoCapitalize="none"
            value={values.mobileAppLatestVersion}
            onChangeText={value => onChangeValue("mobileAppLatestVersion", value)}
          />
          <TextInput
            style={styles.input}
            placeholder="URL de atualização do app"
            autoCapitalize="none"
            value={values.mobileAppDownloadUrl}
            onChangeText={value => onChangeValue("mobileAppDownloadUrl", value)}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <Pressable
            onPress={onSave}
            disabled={saving || loading}
            style={[styles.primaryButton, (saving || loading) && styles.buttonDisabled]}
          >
            {saving || loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.primaryButtonText}>Salvar configurações</Text>
            )}
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

function TicketDetailScreen({
  ticket,
  messages,
  draft,
  loading,
  sending,
  recording,
  error,
  onBack,
  onChangeDraft,
  onSend,
  onPickImage,
  onPickFile,
  onToggleRecording,
  onRefresh,
  onAccept,
  onReturn,
  onResolve,
  onReopen,
  onOpenTransfer,
  onOpenContact,
  onCreateCertificateOrder,
  onOpenTags,
  onOpenFlow,
  onOpenKanbanMove,
}) {
  const showAccept = ticket?.status === "pending";
  const showReturn = ticket?.status === "open";
  const showResolve = ticket?.status === "open";
  const showReopen = ticket?.status === "closed";
  const conversationScrollRef = useRef(null);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (loading) {
      return;
    }

    const timer = setTimeout(() => {
      conversationScrollRef.current?.scrollToEnd({ animated: false });
    }, 40);

    return () => clearTimeout(timer);
  }, [ticket?.id, messages.length, loading]);

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <View
        style={[
          styles.appBar,
          {
            paddingTop: Math.max(insets.top, 12) + 6,
          },
        ]}
      >
        <ContactAvatar contact={ticket?.contact} size={40} />
        <View style={styles.flexOne}>
          <Text style={styles.appBarTitle} numberOfLines={1}>
            {ticket?.contact?.name || ticket?.contact?.number || "Ticket"}
          </Text>
          <Text style={styles.appBarSubtitle}>
            #{ticket?.id} • {ticket?.user?.name || "Sem responsavel"}
          </Text>
        </View>
        <ActionButton label="Voltar" onPress={onBack} />
      </View>

      <KeyboardAvoidingView
        style={styles.flexOne}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 18}
      >
        <View style={styles.ticketActionPanel}>
          <View style={styles.card}>
            <View style={styles.ticketTop}>
              <Text style={styles.sectionTitle}>Acoes do ticket</Text>
              <StatusBadge status={ticket?.status} />
            </View>

            <Text style={styles.helperText}>
              {ticket?.queue?.name || "Sem fila"} •{" "}
              {ticket?.pipeline?.name || "Kanban principal"} •{" "}
              {ticket?.kanbanStage?.name || "Sem etapa"}
            </Text>

            <View style={styles.actionsRow}>
              {showAccept ? (
                <ActionButton label="✓ Assumir" primary onPress={onAccept} />
              ) : null}
              {showReturn ? <ActionButton label="↩ Devolver" onPress={onReturn} /> : null}
              {showResolve ? (
                <ActionButton label="✔ Resolver" primary onPress={onResolve} />
              ) : null}
              {showReopen ? (
                <ActionButton label="↺ Reabrir" primary onPress={onReopen} />
              ) : null}
              <ActionButton label="⇄ Transferir" onPress={onOpenTransfer} />
            </View>

            <View style={styles.actionsRow}>
              <ActionButton label="👤" onPress={onOpenContact} />
              <ActionButton label="📄 Pedido" onPress={onCreateCertificateOrder} />
              <ActionButton label="🏷" onPress={onOpenTags} />
              <ActionButton label="⚡" onPress={onOpenFlow} />
              <ActionButton label="▥" onPress={onOpenKanbanMove} />
              <ActionButton label="↻" onPress={onRefresh} />
            </View>

            <View style={styles.badgesWrap}>
              {(ticket?.tags || []).map(tag => (
                <Badge
                  key={tag.id}
                  label={tag.name}
                  color={tag.color || "#64748b"}
                />
              ))}
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>
        </View>

        <ScrollView
          ref={conversationScrollRef}
          contentContainerStyle={styles.screenContent}
          onContentSizeChange={() => {
            conversationScrollRef.current?.scrollToEnd({ animated: false });
          }}
        >
          {loading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color="#3f51b5" />
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Mensagens</Text>
              <View style={styles.messagesList}>
                {messages.map(message => (
                  <View
                    key={String(message.id)}
                    style={[
                      styles.messageBubble,
                      message.fromMe
                        ? styles.messageBubbleMine
                        : styles.messageBubbleOther,
                    ]}
                  >
                    <MediaMessageContent
                      message={message}
                      fromMe={Boolean(message.fromMe)}
                    />
                    {getMessageBodyText(message) ? (
                      <Text
                        style={[
                          styles.messageText,
                          message.fromMe && styles.messageTextMine,
                        ]}
                      >
                        {getMessageBodyText(message)}
                      </Text>
                    ) : null}
                    <Text
                      style={[
                        styles.messageTime,
                        message.fromMe && styles.messageTimeMine,
                      ]}
                    >
                      {formatDateTime(message.createdAt)}
                    </Text>
                  </View>
                ))}
                {!messages.length ? (
                  <Text style={styles.emptyText}>Sem mensagens.</Text>
                ) : null}
              </View>
            </View>
          )}
        </ScrollView>

        <View style={styles.composerShell}>
          <View
            style={[
              styles.composerShellInset,
              { paddingBottom: Math.max(insets.bottom, 12) },
            ]}
          >
          <View style={styles.composerActions}>
            <ComposerIconButton
              icon="🖼"
              label="Foto"
              onPress={onPickImage}
              disabled={sending || recording}
            />
            <ComposerIconButton
              icon="📎"
              label="Arquivo"
              onPress={onPickFile}
              disabled={sending || recording}
            />
            <ComposerIconButton
              icon={recording ? "⏹" : "🎤"}
              label={recording ? "Parar" : "Áudio"}
              onPress={onToggleRecording}
              disabled={sending}
              active={recording}
            />
          </View>

          <View style={styles.composer}>
            <TextInput
              style={styles.composerInput}
              placeholder="Digite uma mensagem ou legenda"
              multiline
              value={draft}
              onChangeText={onChangeDraft}
            />
            <Pressable
              onPress={onSend}
              disabled={sending}
              style={[styles.primaryButtonSmall, sending && styles.buttonDisabled]}
            >
              {sending ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Enviar</Text>
              )}
            </Pressable>
          </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ContactDetailScreen({
  contact,
  error,
  extraPipelines,
  selectedExtraPipelineId,
  selectedExtraStageId,
  contactPipelineSaving,
  certificateOrders,
  certificateOrdersLoading,
  certificateOrdersError,
  certificateOrdersFetched,
  onBack,
  onRefresh,
  onOpenTags,
  onStartConversation,
  onLoadCertificateOrders,
  onSelectExtraPipeline,
  onSelectExtraStage,
  onAddExtraPipeline,
  onMoveExtraPipelineStage,
  onRemoveExtraPipeline,
}) {
  const memberships = contact?.pipelineMemberships || [];
  const addablePipelines = extraPipelines.filter(
    pipeline =>
      !memberships.some(
        membership => String(membership.pipelineId) === String(pipeline.id),
      ),
  );
  const selectedExtraPipeline =
    extraPipelines.find(
      pipeline => String(pipeline.id) === String(selectedExtraPipelineId),
    ) || null;
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safeArea} edges={["left", "right"]}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />
      <View
        style={[
          styles.appBar,
          {
            paddingTop: Math.max(insets.top, 12) + 6,
          },
        ]}
      >
        <ContactAvatar contact={contact} size={40} />
        <View style={styles.flexOne}>
          <Text style={styles.appBarTitle} numberOfLines={1}>
            {contact?.name || "Contato"}
          </Text>
          <Text style={styles.appBarSubtitle}>
            {contact?.number || "Sem numero"}
          </Text>
        </View>
        <ActionButton label="Voltar" onPress={onBack} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.screenContent,
          { paddingBottom: Math.max(insets.bottom, 24) + 12 },
        ]}
      >
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Dados</Text>
          <Text style={styles.helperText}>Nome: {contact?.name || "-"}</Text>
          <Text style={styles.helperText}>Numero: {contact?.number || "-"}</Text>
          <Text style={styles.helperText}>Email: {contact?.email || "-"}</Text>
          <View style={styles.actionsRow}>
            <ActionButton
              label="Conversar"
              primary
              onPress={onStartConversation}
            />
            <ActionButton label="Atualizar" onPress={onRefresh} />
            <ActionButton label="Etiquetas" onPress={onOpenTags} />
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Pipelines do contato</Text>
          <Text style={styles.helperText}>
            Esses pipelines paralelos categorizam o contato sem mexer no ticket principal.
          </Text>

          {memberships.length ? (
            memberships.map(membership => {
              const membershipPipeline =
                extraPipelines.find(
                  pipeline => String(pipeline.id) === String(membership.pipelineId),
                ) || membership.pipeline;
              const stageOptions = (membershipPipeline?.stages || []).filter(
                stage => stage.active !== false,
              );

              return (
                <View
                  key={membership.id || `${membership.contactId}-${membership.pipelineId}`}
                  style={styles.contactPipelineCard}
                >
                  <View style={styles.contactPipelineHeader}>
                    <Text style={styles.contactPipelineTitle}>
                      {membershipPipeline?.name || "Pipeline"}
                    </Text>
                    <Pressable
                      onPress={() => onRemoveExtraPipeline(membership)}
                      disabled={contactPipelineSaving}
                      style={[
                        styles.contactPipelineRemoveButton,
                        contactPipelineSaving && styles.buttonDisabled,
                      ]}
                    >
                      <Text style={styles.contactPipelineRemoveButtonText}>Remover</Text>
                    </Pressable>
                  </View>

                  <View style={styles.badgesWrap}>
                    {stageOptions.map(stage => {
                      const active =
                        String(stage.id) === String(membership.kanbanStageId);

                      return (
                        <Pressable
                          key={stage.id}
                          onPress={() =>
                            onMoveExtraPipelineStage(membership, stage.id)
                          }
                          disabled={contactPipelineSaving || active}
                          style={[
                            styles.contactPipelineStageButton,
                            active && {
                              backgroundColor:
                                stage.color || membershipPipeline?.color || "#3f51b5",
                              borderColor:
                                stage.color || membershipPipeline?.color || "#3f51b5",
                            },
                            contactPipelineSaving && styles.buttonDisabled,
                          ]}
                        >
                          <Text
                            style={[
                              styles.contactPipelineStageButtonText,
                              active && styles.contactPipelineStageButtonTextActive,
                            ]}
                          >
                            {stage.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyText}>
              Este contato ainda não está em pipelines paralelos.
            </Text>
          )}

          {!!addablePipelines.length ? (
            <View style={styles.contactPipelineComposer}>
              <Text style={styles.helperText}>Adicionar a outro pipeline</Text>
              <View style={styles.badgesWrap}>
                {addablePipelines.map(pipeline => {
                  const active =
                    String(pipeline.id) === String(selectedExtraPipelineId);

                  return (
                    <Pressable
                      key={pipeline.id}
                      onPress={() => onSelectExtraPipeline(pipeline.id)}
                      style={[
                        styles.contactPipelineStageButton,
                        active && {
                          backgroundColor: pipeline.color || "#3f51b5",
                          borderColor: pipeline.color || "#3f51b5",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.contactPipelineStageButtonText,
                          active && styles.contactPipelineStageButtonTextActive,
                        ]}
                      >
                        {pipeline.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {selectedExtraPipeline ? (
                <>
                  <Text style={styles.helperText}>Escolha a etapa inicial</Text>
                  <View style={styles.badgesWrap}>
                    {(selectedExtraPipeline.stages || [])
                      .filter(stage => stage.active !== false)
                      .map(stage => {
                        const active =
                          String(stage.id) === String(selectedExtraStageId);

                        return (
                          <Pressable
                            key={stage.id}
                            onPress={() => onSelectExtraStage(stage.id)}
                            style={[
                              styles.contactPipelineStageButton,
                              active && {
                                backgroundColor:
                                  stage.color ||
                                  selectedExtraPipeline.color ||
                                  "#3f51b5",
                                borderColor:
                                  stage.color ||
                                  selectedExtraPipeline.color ||
                                  "#3f51b5",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.contactPipelineStageButtonText,
                                active &&
                                  styles.contactPipelineStageButtonTextActive,
                              ]}
                            >
                              {stage.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                  </View>
                </>
              ) : null}

              <View style={styles.actionsRow}>
                <ActionButton
                  label={contactPipelineSaving ? "Salvando..." : "Adicionar pipeline"}
                  primary
                  onPress={onAddExtraPipeline}
                />
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Pedidos do cliente</Text>
          <Text style={styles.helperText}>
            Use o telefone deste contato para buscar pedidos já existentes no módulo de certificados.
          </Text>
          <View style={styles.actionsRow}>
            <ActionButton
              label={certificateOrdersLoading ? "Buscando..." : "Buscar pedidos"}
              primary
              onPress={onLoadCertificateOrders}
            />
          </View>

          {certificateOrdersError ? (
            <Text style={styles.errorText}>{certificateOrdersError}</Text>
          ) : null}

          {certificateOrdersLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color="#3f51b5" />
            </View>
          ) : null}

          {!certificateOrdersLoading && certificateOrdersFetched && !certificateOrders.length ? (
            <Text style={styles.emptyText}>Nenhum pedido encontrado para esse telefone.</Text>
          ) : null}

          {!certificateOrdersLoading && certificateOrders.length
            ? certificateOrders.map(order => (
                <CertificateOrderCard
                  key={`${order.identifier}-${order.protocol || ""}`}
                  order={order}
                />
              ))
            : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Etiquetas</Text>
          <View style={styles.badgesWrap}>
            {(contact?.tags || []).map(tag => (
              <Badge
                key={tag.id}
                label={tag.name}
                color={tag.color || "#64748b"}
              />
            ))}
            {!contact?.tags?.length ? (
              <Text style={styles.emptyText}>Nenhuma etiqueta.</Text>
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TransferModal({
  visible,
  userSearch,
  userOptions,
  queues,
  selectedUserId,
  selectedQueueId,
  saving,
  onClose,
  onChangeUserSearch,
  onSelectUser,
  onSelectQueue,
  onSave,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Transferir ticket</Text>

          <TextInput
            style={styles.input}
            placeholder="Buscar usuario"
            value={userSearch}
            onChangeText={onChangeUserSearch}
          />

          <Text style={styles.modalSectionTitle}>Usuarios</Text>
          <ScrollView style={styles.modalList}>
            {userOptions.map(user => (
              <Pressable
                key={user.id}
                onPress={() => onSelectUser(user.id)}
                style={[
                  styles.modalOption,
                  String(selectedUserId) === String(user.id) &&
                    styles.modalOptionActive,
                ]}
              >
                <Text style={styles.modalOptionTitle}>{user.name}</Text>
                <Text style={styles.modalOptionText}>
                  {user.profile} • {user.email}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.modalSectionTitle}>Filas</Text>
          <ScrollView style={styles.modalListSmall}>
            <Pressable
              onPress={() => onSelectQueue("")}
              style={[
                styles.modalOption,
                !selectedQueueId && styles.modalOptionActive,
              ]}
            >
              <Text style={styles.modalOptionTitle}>Sem fila</Text>
            </Pressable>
            {queues.map(queue => (
              <Pressable
                key={queue.id}
                onPress={() => onSelectQueue(queue.id)}
                style={[
                  styles.modalOption,
                  String(selectedQueueId) === String(queue.id) &&
                    styles.modalOptionActive,
                ]}
              >
                <Text style={styles.modalOptionTitle}>{queue.name}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.actionsRow}>
            <ActionButton label="Cancelar" onPress={onClose} />
            <Pressable
              onPress={onSave}
              disabled={saving}
              style={[styles.primaryButtonSmall, saving && styles.buttonDisabled]}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Transferir</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function PickerModal({
  visible,
  title,
  items,
  onClose,
  onSelect,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView style={styles.modalList}>
            {items.map(item => (
              <Pressable
                key={String(item.id)}
                onPress={() => onSelect(item)}
                style={styles.modalOption}
              >
                <Text style={styles.modalOptionTitle}>{item.label}</Text>
                {item.description ? (
                  <Text style={styles.modalOptionText}>{item.description}</Text>
                ) : null}
              </Pressable>
            ))}
            {!items.length ? <Text style={styles.emptyText}>Nada disponivel.</Text> : null}
          </ScrollView>
          <ActionButton label="Fechar" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function TagModal({
  visible,
  title,
  tags,
  selectedIds,
  saving,
  onToggle,
  onClose,
  onSave,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>{title}</Text>
          <ScrollView style={styles.modalList}>
            {tags.map(tag => {
              const active = selectedIds.includes(tag.id);
              return (
                <Pressable
                  key={tag.id}
                  onPress={() => onToggle(tag.id)}
                  style={[
                    styles.modalOption,
                    active && styles.modalOptionActive,
                  ]}
                >
                  <Text style={styles.modalOptionTitle}>{tag.name}</Text>
                  <Text style={styles.modalOptionText}>
                    {active ? "Selecionada" : "Toque para selecionar"}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.actionsRow}>
            <ActionButton label="Cancelar" onPress={onClose} />
            <Pressable
              onPress={onSave}
              disabled={saving}
              style={[styles.primaryButtonSmall, saving && styles.buttonDisabled]}
            >
              {saving ? (
                <ActivityIndicator color="#ffffff" />
              ) : (
                <Text style={styles.primaryButtonText}>Salvar</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function AppContent() {
  const [apiUrl, setApiUrl] = useState(defaultApiUrl);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);
  const [savedCredentials, setSavedCredentials] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [appState, setAppState] = useState(AppState.currentState);

  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [publicSettings, setPublicSettings] = useState({
    ...DEFAULT_PUBLIC_SETTINGS,
    mobileAppDownloadUrl: getDefaultMobileDownloadUrl(defaultApiUrl),
  });
  const [appSettingsValues, setAppSettingsValues] = useState({
    ...DEFAULT_PUBLIC_SETTINGS,
    mobileAppDownloadUrl: getDefaultMobileDownloadUrl(defaultApiUrl),
  });
  const [appSettingsLoading, setAppSettingsLoading] = useState(false);
  const [appSettingsSaving, setAppSettingsSaving] = useState(false);
  const [appSettingsError, setAppSettingsError] = useState("");

  const [section, setSection] = useState("tickets");
  const [certificateView, setCertificateView] = useState("orders");
  const [ticketView, setTicketView] = useState("inbox");
  const [ticketSearch, setTicketSearch] = useState("");
  const [tickets, setTickets] = useState([]);
  const [inboxCertificateSummaries, setInboxCertificateSummaries] = useState({});
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketsError, setTicketsError] = useState("");

  const [contacts, setContacts] = useState([]);
  const [contactSearch, setContactSearch] = useState("");
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState("");

  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);

  const [selectedContact, setSelectedContact] = useState(null);
  const [contactDetailError, setContactDetailError] = useState("");
  const [selectedContactPipelineId, setSelectedContactPipelineId] = useState("");
  const [selectedContactStageId, setSelectedContactStageId] = useState("");
  const [contactPipelineSaving, setContactPipelineSaving] = useState(false);
  const [contactCertificateOrders, setContactCertificateOrders] = useState([]);
  const [contactCertificateOrdersLoading, setContactCertificateOrdersLoading] =
    useState(false);
  const [contactCertificateOrdersError, setContactCertificateOrdersError] =
    useState("");
  const [contactCertificateOrdersFetched, setContactCertificateOrdersFetched] =
    useState(false);
  const [ticketCertificateOrderPickerVisible, setTicketCertificateOrderPickerVisible] =
    useState(false);
  const [ticketCertificateOrderPickerLoading, setTicketCertificateOrderPickerLoading] =
    useState(false);
  const [ticketCertificateOrderPickerError, setTicketCertificateOrderPickerError] =
    useState("");
  const [ticketCertificateOrderPickerOrders, setTicketCertificateOrderPickerOrders] =
    useState([]);

  const [certificateOrderSearch, setCertificateOrderSearch] = useState("");
  const [certificateDateRange, setCertificateDateRange] = useState(
    getCurrentMonthRange,
  );
  const [certificateOrders, setCertificateOrders] = useState([]);
  const [certificateOrdersLoading, setCertificateOrdersLoading] = useState(false);
  const [certificateOrdersError, setCertificateOrdersError] = useState("");
  const [certificateOrdersPage, setCertificateOrdersPage] = useState(1);
  const [certificateOrdersPagination, setCertificateOrdersPagination] = useState({
    page: 1,
    limit: CERTIFICATE_PAGE_SIZE,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
  });

  const [certificateCreateForm, setCertificateCreateForm] = useState(
    EMPTY_CERTIFICATE_CREATE_FORM,
  );
  const [certificateProducts, setCertificateProducts] = useState([]);
  const [certificateProductsLoading, setCertificateProductsLoading] =
    useState(false);
  const [certificateProductSelectorOpen, setCertificateProductSelectorOpen] =
    useState(false);
  const [certificateCustomerLookupLoading, setCertificateCustomerLookupLoading] =
    useState(false);
  const [certificateCustomerLookupSummary, setCertificateCustomerLookupSummary] =
    useState("");
  const [certificateCreateLoading, setCertificateCreateLoading] = useState(false);
  const [certificateCreateResponse, setCertificateCreateResponse] = useState("");
  const [lastCertificateLookupDocument, setLastCertificateLookupDocument] =
    useState("");
  const [certificateChatMessages, setCertificateChatMessages] = useState(
    INITIAL_CERTIFICATE_CHAT_MESSAGES,
  );
  const [certificateChatInput, setCertificateChatInput] = useState("");
  const [certificateChatAttachments, setCertificateChatAttachments] = useState([]);
  const [certificateChatLoading, setCertificateChatLoading] = useState(false);
  const [certificateChatRecording, setCertificateChatRecording] = useState(false);
  const [showCertificateRealtime, setShowCertificateRealtime] = useState(false);
  const certificateRealtimeWebViewRef = useRef(null);

  const [tags, setTags] = useState([]);
  const [flows, setFlows] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [queues, setQueues] = useState([]);
  const [userOptions, setUserOptions] = useState([]);

  const [kanbanTickets, setKanbanTickets] = useState([]);
  const [kanbanContactMemberships, setKanbanContactMemberships] = useState([]);
  const [kanbanLoading, setKanbanLoading] = useState(false);
  const [kanbanError, setKanbanError] = useState("");
  const [selectedKanbanPipelineId, setSelectedKanbanPipelineId] = useState("");

  const [transferVisible, setTransferVisible] = useState(false);
  const [transferSaving, setTransferSaving] = useState(false);
  const [transferUserSearch, setTransferUserSearch] = useState("");
  const [selectedTransferUserId, setSelectedTransferUserId] = useState("");
  const [selectedTransferQueueId, setSelectedTransferQueueId] = useState("");

  const [flowPickerVisible, setFlowPickerVisible] = useState(false);
  const [kanbanMoveVisible, setKanbanMoveVisible] = useState(false);
  const [kanbanMovePipelineId, setKanbanMovePipelineId] = useState("");
  const [tagModalVisible, setTagModalVisible] = useState(false);
  const [tagTarget, setTagTarget] = useState("ticket");
  const [tagIds, setTagIds] = useState([]);
  const [tagSaving, setTagSaving] = useState(false);

  const normalizedApiUrl = useMemo(() => normalizeApiUrl(apiUrl), [apiUrl]);
  const isAdmin = String(user?.profile || "").toUpperCase() === "ADMIN";
  const availableSections = isAdmin
    ? sections
    : sections.filter(item => item.key !== "certificates");
  const principalPipeline = useMemo(
    () => getPrincipalPipeline(pipelines),
    [pipelines],
  );
  const extraContactPipelines = useMemo(
    () => pipelines.filter(pipeline => !isPrincipalPipeline(pipeline)),
    [pipelines],
  );
  const appName =
    String(publicSettings.appName || "").trim() || APP_NAME_FALLBACK;
  const appLogoUrl = String(publicSettings.appLogoUrl || "").trim();
  const latestMobileVersion =
    String(publicSettings.mobileAppLatestVersion || "").trim() || APP_VERSION;
  const mobileDownloadUrl =
    String(publicSettings.mobileAppDownloadUrl || "").trim() ||
    getDefaultMobileDownloadUrl(normalizedApiUrl || defaultApiUrl);
  const updateAvailable = compareVersions(APP_VERSION, latestMobileVersion) < 0;
  const currentKanbanPipeline =
    pipelines.find(p => String(p.id) === String(selectedKanbanPipelineId)) ||
    principalPipeline;
  const certificateDocumentDigits = normalizeDocumentDigits(
    certificateCreateForm.document,
  );
  const requestedCertificatePersonType =
    certificateDocumentDigits.length === 11
      ? "pf"
      : certificateDocumentDigits.length === 14
        ? "pj"
        : "";
  const selectedCertificateProduct =
    certificateProducts.find(
      item =>
        createProductKey(item) === certificateCreateForm.selectedProductKey,
    ) || null;

  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  async function persistCredentials(nextApiUrl, nextEmail, nextPassword) {
    const payload = {
      apiUrl: normalizeApiUrl(nextApiUrl),
      email: String(nextEmail || "").trim(),
      password: String(nextPassword || ""),
    };

    await SecureStore.setItemAsync(AUTH_STORAGE_KEY, JSON.stringify(payload));
    setSavedCredentials(payload);
  }

  async function clearStoredCredentials() {
    await SecureStore.deleteItemAsync(AUTH_STORAGE_KEY);
    setSavedCredentials(null);
  }

  async function performLogin(
    credentials = {},
    options = {},
  ) {
    const { persist = true } = options;
    const targetApiUrl = normalizeApiUrl(credentials.apiUrl || apiUrl);
    const nextEmail = String(credentials.email ?? email).trim();
    const nextPassword = String(credentials.password ?? password);

    const payload = await apiFetch(targetApiUrl, "/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: nextEmail,
        password: nextPassword,
      }),
    });

    setApiUrl(targetApiUrl);
    setEmail(nextEmail);
    setPassword(nextPassword);
    setToken(payload.token);
    setUser(payload.user);

    if (persist) {
      await persistCredentials(targetApiUrl, nextEmail, nextPassword);
    }

    return payload;
  }

  async function requestApi(path, options = {}, requestToken = token) {
    try {
      return await apiFetch(normalizedApiUrl, path, options, requestToken);
    } catch (error) {
      const message = String(error?.message || "");
      const shouldRetry =
        !!savedCredentials &&
        (
          /invalid token/i.test(message) ||
          /session expired/i.test(message) ||
          message.includes("401") ||
          message.includes("403")
        );

      if (!shouldRetry) {
        throw error;
      }

      const refreshed = await performLogin(savedCredentials, { persist: false });
      return apiFetch(
        normalizeApiUrl(savedCredentials.apiUrl),
        path,
        options,
        refreshed.token,
      );
    }
  }

  async function requestCertificates(path, options = {}, requestToken = token) {
    return requestApi(`/certificates${path}`, options, requestToken);
  }

  async function loadPublicSettings(targetApiUrl = normalizedApiUrl || defaultApiUrl) {
    const requestBaseUrl = normalizeApiUrl(targetApiUrl || defaultApiUrl);

    if (!requestBaseUrl) {
      return;
    }

    try {
      const payload = await apiFetch(requestBaseUrl, "/settings/public");
      setPublicSettings(mergePublicSettings(payload, requestBaseUrl));
    } catch (_error) {
      setPublicSettings(prevState => ({
        ...DEFAULT_PUBLIC_SETTINGS,
        ...prevState,
        mobileAppDownloadUrl:
          String(prevState.mobileAppDownloadUrl || "").trim() ||
          getDefaultMobileDownloadUrl(requestBaseUrl),
      }));
    }
  }

  async function loadAppSettings(currentToken = token) {
    if (!currentToken || !isAdmin) {
      return;
    }

    setAppSettingsLoading(true);
    setAppSettingsError("");

    try {
      const payload = await requestApi("/settings", {}, currentToken);
      setAppSettingsValues(mergePublicSettings(payload, normalizedApiUrl || defaultApiUrl));
    } catch (error) {
      setAppSettingsError(error.message);
    } finally {
      setAppSettingsLoading(false);
    }
  }

  function handleChangeAppSetting(key, value) {
    setAppSettingsValues(prevState => ({
      ...prevState,
      [key]: value,
    }));
  }

  async function saveAppSettings() {
    if (!token || !isAdmin) {
      return;
    }

    const nextSettings = {
      appName:
        String(appSettingsValues.appName || "").trim() || APP_NAME_FALLBACK,
      appLogoUrl: String(appSettingsValues.appLogoUrl || "").trim(),
      mobileAppLatestVersion:
        String(appSettingsValues.mobileAppLatestVersion || "").trim() ||
        APP_VERSION,
      mobileAppDownloadUrl:
        String(appSettingsValues.mobileAppDownloadUrl || "").trim() ||
        getDefaultMobileDownloadUrl(normalizedApiUrl || defaultApiUrl),
    };

    setAppSettingsSaving(true);
    setAppSettingsError("");

    try {
      await Promise.all(
        Object.entries(nextSettings).map(([key, value]) =>
          requestApi(`/settings/${key}`, {
            method: "PUT",
            body: JSON.stringify({ value }),
          }),
        ),
      );

      setPublicSettings(prevState => ({
        ...prevState,
        ...nextSettings,
      }));
      setAppSettingsValues(nextSettings);
    } catch (error) {
      setAppSettingsError(error.message);
    } finally {
      setAppSettingsSaving(false);
    }
  }

  async function openAppUpdate() {
    if (!mobileDownloadUrl) {
      return;
    }

    try {
      await Linking.openURL(mobileDownloadUrl);
    } catch (error) {
      const message = String(error?.message || "Nao foi possivel abrir a URL.");
      setAuthError(message);
      setAppSettingsError(message);
    }
  }

  async function configureNotifications() {
    const permissions = await Notifications.getPermissionsAsync();
    let finalStatus = permissions.status;

    if (finalStatus !== "granted") {
      const requested = await Notifications.requestPermissionsAsync();
      finalStatus = requested.status;
    }

    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    return finalStatus === "granted";
  }

  async function registerBackgroundRefresh() {
    try {
      const taskManagerAvailable = await TaskManager.isAvailableAsync();

      if (!taskManagerAvailable) {
        return false;
      }

      const backgroundStatus = await BackgroundTask.getStatusAsync();

      if (backgroundStatus !== BackgroundTask.BackgroundTaskStatus.Available) {
        return false;
      }

      const registeredTasks = await TaskManager.getRegisteredTasksAsync();
      const alreadyRegistered = registeredTasks.some(
        task => task.taskName === BACKGROUND_TASK_NAME,
      );

      if (!alreadyRegistered) {
        await BackgroundTask.registerTaskAsync(BACKGROUND_TASK_NAME, {});
      }

      return true;
    } catch (_error) {
      return false;
    }
  }

  async function refreshAppData() {
    if (!token) return;

    await Promise.all([
      loadReferenceData(),
      section === "contacts"
        ? loadContacts(undefined, { silent: true })
        : loadTickets(undefined, undefined, { silent: true }),
      ticketView === "kanban"
        ? loadKanbanTickets({ silent: true })
        : Promise.resolve(),
      selectedTicket?.id
        ? loadMessages(selectedTicket.id, { silent: true })
        : Promise.resolve(),
    ]);
  }

  async function syncCurrentSessionNotifications(notify = false) {
    if (!token) return;

    try {
      const payload = await requestApi("/tickets?pageNumber=1&showAll=true");
      await syncTicketNotifications(payload.tickets || [], notify && appState !== "active");
    } catch (_error) {}
  }

  async function loadReferenceData(currentToken = token) {
    if (!currentToken) return;

    const [tagsData, flowsData, pipelinesData, queuesData, usersData] =
      await Promise.all([
        requestApi("/tags", {}, currentToken),
        requestApi("/flows", {}, currentToken),
        requestApi("/kanban-pipelines", {}, currentToken),
        requestApi("/queue", {}, currentToken),
        requestApi("/users?pageNumber=1", {}, currentToken),
      ]);

    setTags(Array.isArray(tagsData) ? tagsData : []);
    setFlows(Array.isArray(flowsData) ? flowsData : []);
    setPipelines(Array.isArray(pipelinesData) ? pipelinesData : []);
    setQueues(Array.isArray(queuesData) ? queuesData : []);
    setUserOptions(usersData?.users || []);

    if (!selectedKanbanPipelineId) {
      const nextPrincipal = getPrincipalPipeline(
        Array.isArray(pipelinesData) ? pipelinesData : [],
      );
      if (nextPrincipal?.id) {
        setSelectedKanbanPipelineId(String(nextPrincipal.id));
      }
    }
  }

  async function loadCertificateOrders(targetPage = certificateOrdersPage) {
    if (!token || !isAdmin) return;

    setCertificateOrdersLoading(true);
    setCertificateOrdersError("");

    try {
      const params = new URLSearchParams({
        search: certificateOrderSearch.trim(),
        page: String(targetPage || 1),
        limit: String(CERTIFICATE_PAGE_SIZE),
        startDate: certificateDateRange.startDate,
        endDate: certificateDateRange.endDate,
      });
      const payload = await requestCertificates(`/orders?${params.toString()}`);
      setCertificateOrders(payload.orders || []);
      setCertificateOrdersPage(targetPage);
      if (payload.filters) {
        setCertificateDateRange(payload.filters);
      }
      setCertificateOrdersPagination(
        payload.pagination || {
          page: targetPage,
          limit: CERTIFICATE_PAGE_SIZE,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
        },
      );
    } catch (error) {
      setCertificateOrdersError(error.message);
    } finally {
      setCertificateOrdersLoading(false);
    }
  }

  async function loadCertificateOrdersForContact(contactId) {
    if (!token || !isAdmin || !contactId) return;

    setContactCertificateOrdersLoading(true);
    setContactCertificateOrdersError("");

    try {
      const payload = await requestCertificates(
        `/orders/by-contact/${contactId}?page=1&limit=20&all=true`,
      );
      setContactCertificateOrders(payload.orders || []);
      setContactCertificateOrdersFetched(true);
    } catch (error) {
      setContactCertificateOrdersError(error.message);
      setContactCertificateOrdersFetched(true);
    } finally {
      setContactCertificateOrdersLoading(false);
    }
  }

  async function loadCertificateProducts(
    personType = requestedCertificatePersonType,
  ) {
    if (!token || !isAdmin) return;

    setCertificateProductsLoading(true);
    try {
      const query = personType ? `?personType=${personType}` : "";
      const payload = await requestCertificates(
        `/lookups/create-order-products${query}`,
      );
      const nextProducts = payload.products || [];
      setCertificateProducts(nextProducts);
      return nextProducts;
    } catch (error) {
      setCertificateOrdersError(error.message);
      return [];
    } finally {
      setCertificateProductsLoading(false);
    }
  }

  async function openCreateOrderFromTicket() {
    if (!selectedTicket?.contact?.id) {
      return;
    }

    setTicketCertificateOrderPickerLoading(true);
    setTicketCertificateOrderPickerError("");
    setTicketCertificateOrderPickerVisible(true);

    try {
      const payload = await requestApi(
        `/contacts/${selectedTicket.contact.id}/certificate-orders?page=1&limit=20&all=true`,
      );
      setTicketCertificateOrderPickerOrders(payload.orders || []);
    } catch (error) {
      setTicketCertificateOrderPickerOrders([]);
      setTicketCertificateOrderPickerError(error.message);
    } finally {
      setTicketCertificateOrderPickerLoading(false);
    }
  }

  async function hydrateCreateOrderFromSelectedTicketOrder(order) {
    if (!order) {
      return;
    }

    const personType = isCompanyDocument(order.document) ? "pj" : "pf";
    const nextProducts = (await loadCertificateProducts(personType)) || [];
    const nextForm = applyCertificateOrderToForm(
      { ...EMPTY_CERTIFICATE_CREATE_FORM, personType },
      order,
      nextProducts,
    );

    setCertificateCreateForm(nextForm);
    setLastCertificateLookupDocument("");
    setTicketCertificateOrderPickerVisible(false);
    setSection("certificates");
    setCertificateView("create");
    setSelectedTicket(null);
    setMessages([]);

    if (normalizeDocumentDigits(order.document)) {
      await lookupCertificateCustomer(order.document, { force: true });
    }
  }

  async function lookupCertificateCustomer(documentValue, options = {}) {
    const documentDigits = normalizeDocumentDigits(documentValue);
    if (![11, 14].includes(documentDigits.length) || !token || !isAdmin) {
      return;
    }

    if (!options.force && documentDigits === lastCertificateLookupDocument) {
      return;
    }

    setCertificateCustomerLookupLoading(true);
    setLastCertificateLookupDocument(documentDigits);

    try {
      const payload = await requestCertificates(
        `/lookups/customer-by-document?document=${documentDigits}`,
      );
      const customer = payload.customer;
      setCertificateCreateForm(current =>
        applyCertificateCustomerLookup(current, customer),
      );
      setCertificateCustomerLookupSummary(
        `${customer.name || "Cliente"} carregado da base (${customer.orderCount} pedidos, último #${customer.latestOrderIdentifier || "-"})`,
      );
    } catch (error) {
      if (error.message === "Cliente nao encontrado na base de pedidos.") {
        setCertificateCustomerLookupSummary(
          "Documento sem histórico na base. Preencha os dados manualmente.",
        );
      } else {
        setCertificateOrdersError(error.message);
      }
    } finally {
      setCertificateCustomerLookupLoading(false);
    }
  }

  async function submitCertificateOrder() {
    if (!token || !isAdmin) return;

    setCertificateCreateLoading(true);
    setCertificateOrdersError("");

    try {
      const documentDigits = normalizeDocumentDigits(certificateCreateForm.document);
      if (![11, 14].includes(documentDigits.length)) {
        throw new Error("Informe um CPF ou CNPJ válido.");
      }
      if (!certificateCreateForm.customerName.trim()) {
        throw new Error("Informe o nome do cliente.");
      }
      if (!certificateCreateForm.productCode.trim()) {
        throw new Error("Selecione um produto.");
      }
      if (!certificateCreateForm.certificateValue.trim()) {
        throw new Error("Informe o valor do certificado.");
      }
      if (
        certificateCreateForm.personType === "pf" &&
        !certificateCreateForm.customerBirthDate.trim()
      ) {
        throw new Error(
          "Informe a data de nascimento para pedido de pessoa física.",
        );
      }
      if (
        certificateCreateForm.personType === "pj" &&
        !normalizeDocumentDigits(certificateCreateForm.representativeDocument)
      ) {
        throw new Error(
          "Informe o CPF do representante para pedido de pessoa jurídica.",
        );
      }

      const payload = await requestCertificates("/orders/create", {
        method: "POST",
        body: JSON.stringify({
          ...certificateCreateForm,
        }),
      });
      console.log("certificates/create form", certificateCreateForm);
      console.log("certificates/create payload", buildCertificateCreateOrderPayload(certificateCreateForm));
      console.log("certificates/create response", payload);
      setCertificateCreateResponse(
        typeof payload.data === "string"
          ? payload.data
          : JSON.stringify(payload.data, null, 2),
      );
      setCertificateView("orders");
      await loadCertificateOrders(1);
    } catch (error) {
      setCertificateOrdersError(error.message);
    } finally {
      setCertificateCreateLoading(false);
    }
  }

  async function pickCertificateChatPdf() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      setCertificateChatAttachments(current => [
        ...current,
        ...result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.name || "documento.pdf",
          type: asset.mimeType || "application/pdf",
        })),
      ]);
      setCertificateOrdersError("");
    } catch (error) {
      setCertificateOrdersError(error.message);
    }
  }

  async function pickCertificateChatAudio() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      setCertificateChatAttachments(current => [
        ...current,
        ...result.assets.map(asset => ({
          uri: asset.uri,
          name: asset.name || `audio-${Date.now()}.m4a`,
          type: asset.mimeType || "audio/mp4",
        })),
      ]);
      setCertificateOrdersError("");
    } catch (error) {
      setCertificateOrdersError(error.message);
    }
  }

  async function pickCertificateChatImage() {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Permita acesso à galeria para anexar imagens.");
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        quality: 0.9,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      setCertificateChatAttachments(current => [
        ...current,
        ...result.assets.map((asset, index) => ({
          uri: asset.uri,
          name: asset.fileName || `imagem-${Date.now()}-${index + 1}.jpg`,
          type: asset.mimeType || "image/jpeg",
        })),
      ]);
      setCertificateOrdersError("");
    } catch (error) {
      setCertificateOrdersError(error.message);
    }
  }

  async function toggleCertificateChatRecording() {
    if (sending || recording) {
      return;
    }

    try {
      if (certificateChatRecording) {
        await audioRecorder.stop();
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
          shouldPlayInBackground: true,
        });
        setCertificateChatRecording(false);

        if (!audioRecorder.uri) {
          throw new Error("Não foi possível salvar o áudio gravado.");
        }

        setCertificateChatAttachments(current => [
          ...current,
          {
            uri: audioRecorder.uri,
            name: `audio-${Date.now()}.m4a`,
            type: "audio/mp4",
          },
        ]);
        setCertificateOrdersError("");
        return;
      }

      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Permita acesso ao microfone para gravar áudio.");
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
        shouldPlayInBackground: true,
      });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setCertificateChatRecording(true);
      setCertificateOrdersError("");
    } catch (error) {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
        shouldPlayInBackground: true,
      }).catch(() => {});
      setCertificateChatRecording(false);
      setCertificateOrdersError(error.message);
    }
  }

  function clearCertificateChat() {
    setCertificateChatMessages(INITIAL_CERTIFICATE_CHAT_MESSAGES);
    setCertificateChatInput("");
    setCertificateChatAttachments([]);
    setCertificateChatRecording(false);
    setShowCertificateRealtime(false);
    setCertificateOrdersError("");
  }

  async function sendCertificateChatMessage() {
    if (!token || !isAdmin || certificateChatLoading) {
      return;
    }

    const trimmedInput = certificateChatInput.trim();
    if (!trimmedInput && !certificateChatAttachments.length) {
      setCertificateOrdersError("Digite uma mensagem ou anexe um documento.");
      return;
    }

    const userMessage = {
      role: "user",
      content: trimmedInput || "Analise os anexos e monte o pedido.",
      attachments: certificateChatAttachments.map(item => item.name),
    };
    const nextMessages = [...certificateChatMessages, userMessage];
    const formData = new FormData();

    formData.append(
      "messages",
      JSON.stringify(
        nextMessages.map(message => ({
          role: message.role,
          content: message.content,
        })),
      ),
    );

    certificateChatAttachments.forEach((attachment, index) => {
      formData.append("attachments", {
        uri: attachment.uri,
        name: attachment.name || `anexo-${index + 1}`,
        type: attachment.type || "application/octet-stream",
      });
    });

    setCertificateOrdersError("");
    setCertificateChatMessages(nextMessages);
    setCertificateChatInput("");
    setCertificateChatAttachments([]);
    setCertificateChatLoading(true);

    try {
      const payload = await requestCertificates("/agent-chat", {
        method: "POST",
        body: formData,
      });
      const assistantMessage = {
        role: "assistant",
        content: payload.message || "Sem resposta do agente.",
        trace: payload.trace || [],
        logId: payload.logId || null,
      };

      setCertificateChatMessages(current => [...current, assistantMessage]);

      if (
        (payload.trace || []).some(
          item => item.tool === "create_order" && item.result?.ok,
        )
      ) {
        await loadCertificateOrders(1);
      }
    } catch (error) {
      setCertificateOrdersError(error.message);
      setCertificateChatMessages(current => [
        ...current,
        {
          role: "assistant",
          content: `Falha no agente: ${error.message}`,
        },
      ]);
    } finally {
      setCertificateChatLoading(false);
    }
  }

  function sendCertificateRealtimeBridgeResponse(
    requestId,
    payload = null,
    errorMessage = "",
  ) {
    if (!certificateRealtimeWebViewRef.current || !requestId) {
      return;
    }

    const bridgePayload = JSON.stringify({
      requestId,
      payload,
      error: errorMessage || "",
    });

    certificateRealtimeWebViewRef.current.injectJavaScript(
      `window.__rnReceive(${JSON.stringify(bridgePayload)}); true;`,
    );
  }

  async function handleCertificateRealtimeWebViewMessage(event) {
    let message = null;
    try {
      message = JSON.parse(event.nativeEvent.data || "{}");
    } catch (_error) {
      return;
    }

    const requestId = message?.requestId;
    const payload = message?.payload || {};

    if (!requestId || !message?.type) {
      return;
    }

    try {
      if (message.type === "request_session") {
        const sessionPayload = await requestCertificates("/realtime/session", {
          method: "POST",
        });
        sendCertificateRealtimeBridgeResponse(requestId, sessionPayload);
        return;
      }

      if (message.type === "tool_call") {
        const toolPayload = await requestCertificates("/realtime/tool-call", {
          method: "POST",
          body: JSON.stringify({
            name: payload.name,
            args: payload.args || {},
            latestUserMessage: payload.latestUserMessage || "",
          }),
        });
        sendCertificateRealtimeBridgeResponse(requestId, toolPayload);
        return;
      }

      sendCertificateRealtimeBridgeResponse(
        requestId,
        null,
        "Mensagem realtime desconhecida.",
      );
    } catch (error) {
      sendCertificateRealtimeBridgeResponse(
        requestId,
        null,
        error?.message || "Falha na ponte realtime.",
      );
    }
  }

  async function loadUsers(searchParam = "") {
    if (!token) return;

    try {
      const params = new URLSearchParams({ pageNumber: "1" });
      if (searchParam.trim()) {
        params.set("searchParam", searchParam.trim());
      }

      const payload = await requestApi(`/users?${params.toString()}`);
      setUserOptions(payload.users || []);
    } catch (_error) {}
  }

  async function loadTickets(
    view = ticketView,
    search = ticketSearch,
    options = {},
  ) {
    if (!token) return;
    const { silent = false } = options;

    if (!silent) {
      setTicketsLoading(true);
    }
    setTicketsError("");

    try {
      const params = new URLSearchParams({ pageNumber: "1" });

      if (view === "inbox") {
        params.set("showAll", "true");
      } else if (view === "closed") {
        params.set("status", "closed");
        params.set("showAll", "true");
      } else if (view === "open") {
        params.set("status", "open");
        if (isAdmin) {
          params.set("showAll", "true");
        }
      } else if (view === "pending") {
        params.set("status", "pending");
      } else {
        params.set("showAll", "true");
      }

      if (search.trim()) {
        params.set("searchParam", search.trim());
      }

      const payload = await requestApi(`/tickets?${params.toString()}`);
      setTickets(payload.tickets || []);
    } catch (error) {
      setTicketsError(error.message);
    } finally {
      if (!silent) {
        setTicketsLoading(false);
      }
    }
  }

  async function loadKanbanTickets(options = {}) {
    if (!token) return;
    const { silent = false } = options;

    if (!silent) {
      setKanbanLoading(true);
    }
    setKanbanError("");

    try {
      if (isPrincipalPipeline(currentKanbanPipeline)) {
        const params = new URLSearchParams({
          pageNumber: "1",
          showAll: "true",
        });

        const payload = await requestApi(`/tickets?${params.toString()}`);
        setKanbanTickets(payload.tickets || []);
        setKanbanContactMemberships([]);
      } else {
        const params = new URLSearchParams({
          pipelineId: String(currentKanbanPipeline?.id || ""),
        });
        const payload = await requestApi(
          `/contact-pipeline-memberships?${params.toString()}`,
        );
        setKanbanContactMemberships(payload.memberships || []);
        setKanbanTickets([]);
      }
    } catch (error) {
      setKanbanError(error.message);
    } finally {
      if (!silent) {
        setKanbanLoading(false);
      }
    }
  }

  async function loadInboxCertificateSummaries(nextTickets = tickets) {
    if (!token || !isAdmin) {
      setInboxCertificateSummaries({});
      return;
    }

    const recentTickets = (nextTickets || [])
      .filter(ticket => ticket?.contact?.id)
      .slice(0, 10);

    if (!recentTickets.length) {
      setInboxCertificateSummaries({});
      return;
    }

    try {
      const results = await Promise.all(
        recentTickets.map(async ticket => {
          const payload = await requestCertificates(
            `/orders/by-contact/${ticket.contact.id}?page=1&limit=1&all=true`,
          );
          return [
            String(ticket.contact.id),
            buildTicketCertificateSummary(payload?.orders?.[0]),
          ];
        }),
      );

      setInboxCertificateSummaries(
        results.reduce((acc, [contactId, summary]) => {
          if (summary) {
            acc[contactId] = summary;
          }
          return acc;
        }, {}),
      );
    } catch (_error) {}
  }

  async function loadContacts(search = contactSearch, options = {}) {
    if (!token) return;
    const { silent = false } = options;

    if (!silent) {
      setContactsLoading(true);
    }
    setContactsError("");

    try {
      const nextContacts = [];
      let pageNumber = 1;
      let hasMore = true;

      while (hasMore && pageNumber <= 200) {
        const params = new URLSearchParams({ pageNumber: String(pageNumber) });
        if (search.trim()) {
          params.set("searchParam", search.trim());
        }

        const payload = await requestApi(`/contacts?${params.toString()}`);
        nextContacts.push(...(payload.contacts || []));
        hasMore = Boolean(payload.hasMore);
        pageNumber += 1;
      }

      setContacts(nextContacts);
    } catch (error) {
      setContactsError(error.message);
    } finally {
      if (!silent) {
        setContactsLoading(false);
      }
    }
  }

  async function loadTicketDetail(ticketId) {
    if (!token || !ticketId) return;

    try {
      const payload = await requestApi(`/tickets/${ticketId}`);
      setSelectedTicket(payload);
      setKanbanMovePipelineId(payload.pipelineId || principalPipeline?.id || "");
    } catch (error) {
      setMessagesError(error.message);
    }
  }

  async function loadMessages(ticketId, options = {}) {
    if (!token || !ticketId) return;
    const { silent = false } = options;

    if (!silent) {
      setMessagesLoading(true);
    }
    setMessagesError("");

    try {
      const payload = await requestApi(`/messages/${ticketId}?pageNumber=1`);
      setMessages(payload.messages || []);
    } catch (error) {
      setMessagesError(error.message);
    } finally {
      if (!silent) {
        setMessagesLoading(false);
      }
    }
  }

  async function openTicket(ticket) {
    setSelectedTicket(ticket);
    await Promise.all([loadTicketDetail(ticket.id), loadMessages(ticket.id)]);
  }

  async function refreshCurrentTicket() {
    if (!selectedTicket?.id) return;
    await Promise.all([
      loadTicketDetail(selectedTicket.id),
      loadMessages(selectedTicket.id),
      loadTickets(),
      loadKanbanTickets(),
    ]);
  }

  async function loadContact(contactId) {
    if (!token || !contactId) return;

    setContactDetailError("");

    try {
      const payload = await requestApi(`/contacts/${contactId}`);
      setSelectedContact(payload);
    } catch (error) {
      setContactDetailError(error.message);
    }
  }

  async function handleLogin() {
    setAuthLoading(true);
    setAuthError("");

    try {
      await performLogin({
        apiUrl,
        email,
        password,
      });
      setSection("tickets");
      setTicketView("inbox");
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    await clearStoredCredentials();
    await SecureStore.deleteItemAsync(TICKET_SNAPSHOT_KEY);
    await Notifications.setBadgeCountAsync(0);
    setToken("");
    setUser(null);
    setPassword("");
    setSelectedTicket(null);
    setSelectedContact(null);
  }

  async function updateTicket(payload) {
    if (!selectedTicket?.id) return;

    setMessagesLoading(true);
    setMessagesError("");

    try {
      await requestApi(`/tickets/${selectedTicket.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      await refreshCurrentTicket();
    } catch (error) {
      setMessagesError(error.message);
      setMessagesLoading(false);
    }
  }

  async function sendMessage() {
    if (!draft.trim() || !selectedTicket?.id) return;

    setSending(true);
    setMessagesError("");

    try {
      await requestApi(`/messages/${selectedTicket.id}`, {
        method: "POST",
        body: JSON.stringify({ body: draft.trim() }),
      });
      setDraft("");
      await refreshCurrentTicket();
    } catch (error) {
      setMessagesError(error.message);
    } finally {
      setSending(false);
    }
  }

  async function uploadTicketMedia(asset, options = {}) {
    if (!selectedTicket?.id || !asset?.uri) return;

    const {
      clearDraft = true,
      body = draft.trim(),
    } = options;

    const filename =
      String(asset.name || asset.fileName || "").trim() ||
      `media-${Date.now()}`;
    const mimeType =
      String(asset.mimeType || asset.type || "").trim() ||
      getFileMimeType(filename);

    const formData = new FormData();
    formData.append("medias", {
      uri: asset.uri,
      name: filename,
      type: mimeType,
    });
    formData.append("body", String(body || "").trim());
    formData.append("fromMe", "true");

    setSending(true);
    setMessagesError("");

    try {
      await requestApi(`/messages/${selectedTicket.id}`, {
        method: "POST",
        body: formData,
      });
      if (clearDraft) {
        setDraft("");
      }
      await refreshCurrentTicket();
    } catch (error) {
      setMessagesError(error.message);
    } finally {
      setSending(false);
    }
  }

  async function handlePickImage() {
    if (!selectedTicket?.id) return;

    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        throw new Error("Permita acesso a galeria para enviar imagens.");
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.9,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const [asset] = result.assets;
      await uploadTicketMedia({
        uri: asset.uri,
        name: asset.fileName || `imagem-${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
      });
    } catch (error) {
      setMessagesError(error.message);
    }
  }

  async function handlePickFile() {
    if (!selectedTicket?.id) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["audio/*", "image/*", "video/*", "application/*", "text/*"],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const [asset] = result.assets;
      await uploadTicketMedia({
        uri: asset.uri,
        name: asset.name || `arquivo-${Date.now()}`,
        mimeType: asset.mimeType || getFileMimeType(asset.name),
      });
    } catch (error) {
      setMessagesError(error.message);
    }
  }

  async function handleToggleRecording() {
    if (!selectedTicket?.id || sending) return;

    try {
      if (recording) {
        await audioRecorder.stop();
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
          shouldPlayInBackground: true,
        });
        setRecording(false);

        if (!audioRecorder.uri) {
          throw new Error("Nao foi possivel salvar o audio gravado.");
        }

        await uploadTicketMedia(
          {
            uri: audioRecorder.uri,
            name: `audio-${Date.now()}.m4a`,
            mimeType: "audio/mp4",
          },
          { clearDraft: false, body: "" },
        );

        return;
      }

      const permission = await requestRecordingPermissionsAsync();

      if (!permission.granted) {
        throw new Error("Permita acesso ao microfone para gravar audio.");
      }

      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
        shouldPlayInBackground: true,
      });
      await audioRecorder.prepareToRecordAsync();
      audioRecorder.record();
      setRecording(true);
      setMessagesError("");
    } catch (error) {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
        shouldPlayInBackground: true,
      }).catch(() => {});
      setRecording(false);
      setMessagesError(error.message);
    }
  }

  async function updateContact(contactId, payload) {
    setTagSaving(true);
    setContactDetailError("");

    try {
      await requestApi(`/contacts/${contactId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      await Promise.all([loadContact(contactId), loadContacts()]);
      if (selectedTicket?.contact?.id === contactId) {
        await loadTicketDetail(selectedTicket.id);
      }
    } catch (error) {
      setContactDetailError(error.message);
      setMessagesError(error.message);
    } finally {
      setTagSaving(false);
    }
  }

  async function addContactToExtraPipeline() {
    if (!selectedContact?.id || !selectedContactPipelineId) return;

    setContactPipelineSaving(true);
    setContactDetailError("");

    try {
      await requestApi(`/contacts/${selectedContact.id}/pipelines`, {
        method: "POST",
        body: JSON.stringify({
          pipelineId: Number(selectedContactPipelineId),
          kanbanStageId: selectedContactStageId ? Number(selectedContactStageId) : null,
        }),
      });
      setSelectedContactPipelineId("");
      setSelectedContactStageId("");
      await loadContact(selectedContact.id);
    } catch (error) {
      setContactDetailError(error.message);
    } finally {
      setContactPipelineSaving(false);
    }
  }

  async function moveContactExtraPipelineStage(membership, kanbanStageId) {
    if (!selectedContact?.id || !membership?.pipelineId || !kanbanStageId) return;

    setContactPipelineSaving(true);
    setContactDetailError("");

    try {
      await requestApi(`/contacts/${selectedContact.id}/pipelines/${membership.pipelineId}`, {
        method: "PUT",
        body: JSON.stringify({
          pipelineId: Number(membership.pipelineId),
          kanbanStageId: Number(kanbanStageId),
        }),
      });
      await loadContact(selectedContact.id);
    } catch (error) {
      setContactDetailError(error.message);
    } finally {
      setContactPipelineSaving(false);
    }
  }

  async function removeContactFromExtraPipeline(membership) {
    if (!selectedContact?.id || !membership?.pipelineId) return;

    setContactPipelineSaving(true);
    setContactDetailError("");

    try {
      await requestApi(`/contacts/${selectedContact.id}/pipelines/${membership.pipelineId}`, {
        method: "DELETE",
      });
      await loadContact(selectedContact.id);
    } catch (error) {
      setContactDetailError(error.message);
    } finally {
      setContactPipelineSaving(false);
    }
  }

  async function saveTransfer() {
    if (!selectedTicket?.id) return;

    setTransferSaving(true);
    setMessagesError("");

    try {
      const payload = {};

      if (selectedTransferUserId) {
        payload.userId = Number(selectedTransferUserId);
      }

      if (selectedTransferQueueId) {
        payload.queueId = Number(selectedTransferQueueId);
      }

      if (selectedTransferQueueId && !selectedTransferUserId) {
        payload.status = "pending";
        payload.userId = null;
      }

      await requestApi(`/tickets/${selectedTicket.id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setTransferVisible(false);
      await refreshCurrentTicket();
    } catch (error) {
      setMessagesError(error.message);
    } finally {
      setTransferSaving(false);
    }
  }

  async function runFlow(flowId) {
    if (!selectedTicket?.id) return;

    try {
      await requestApi(`/flows/${flowId}/run/${selectedTicket.id}`, {
        method: "POST",
      });
      setFlowPickerVisible(false);
      await refreshCurrentTicket();
    } catch (error) {
      setMessagesError(error.message);
    }
  }

  async function moveToStage(stage) {
    if (!selectedTicket?.id) return;

    setKanbanMoveVisible(false);
    if (stage.kind === "principal-status") {
      await updateTicket({
        status: stage.status,
        userId:
          stage.status === "pending"
            ? null
            : selectedTicket?.userId || user?.id || null,
      });
      return;
    }

    await updateTicket({
      pipelineId: stage.pipelineId,
      kanbanStageId: stage.id,
      userId: selectedTicket?.userId || user?.id || null,
    });
  }

  async function saveTags() {
    if (tagTarget === "ticket" && selectedTicket?.id) {
      await updateTicket({
        tagIds: uniqueIds(tagIds),
        userId: selectedTicket?.userId || user?.id || null,
      });
      setTagModalVisible(false);
      return;
    }

    if (tagTarget === "contact" && selectedContact?.id) {
      await updateContact(selectedContact.id, {
        tagIds: uniqueIds(tagIds),
      });
      setTagModalVisible(false);
    }
  }

  async function startConversationFromContact(contact) {
    if (!contact?.id || !token) return;

    setContactDetailError("");

    try {
      const searchValue = String(contact.number || contact.name || "").trim();
      const params = new URLSearchParams({
        pageNumber: "1",
        showAll: "true",
      });

      if (searchValue) {
        params.set("searchParam", searchValue);
      }

      const payload = await requestApi(`/tickets?${params.toString()}`);

      const existingTicket = (payload.tickets || []).find(ticket => {
        return (
          String(ticket.contact?.id) === String(contact.id) &&
          ["open", "pending"].includes(String(ticket.status))
        );
      });

      if (existingTicket) {
        setSelectedContact(null);
        setSection("tickets");
        await openTicket(existingTicket);
        return;
      }

      const newTicket = await requestApi("/tickets", {
        method: "POST",
        body: JSON.stringify({
          contactId: contact.id,
          userId: user?.id,
          status: "open",
        }),
      });

      setSelectedContact(null);
      setSection("tickets");
      await openTicket(newTicket);
    } catch (error) {
      setContactDetailError(error.message);
    }
  }

  useEffect(() => {
    let active = true;

    const hydrateSession = async () => {
      try {
        const stored = await SecureStore.getItemAsync(AUTH_STORAGE_KEY);

        if (!stored) {
          if (active) setAuthReady(true);
          return;
        }

        const parsed = JSON.parse(stored);

        if (!parsed?.email || !parsed?.password) {
          if (active) setAuthReady(true);
          return;
        }

        if (!active) return;

        setSavedCredentials(parsed);
        setApiUrl(parsed.apiUrl || defaultApiUrl);
        setEmail(parsed.email || "");
        setPassword(parsed.password || "");

        try {
          await performLogin(parsed, { persist: false });
        } catch (_error) {}
      } finally {
        if (active) {
          setAuthReady(true);
        }
      }
    };

    hydrateSession();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    configureNotifications();
    registerBackgroundRefresh();
  }, []);

  useEffect(() => {
    setAudioModeAsync({
      allowsRecording: false,
      interruptionMode: "duckOthers",
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      shouldRouteThroughEarpiece: false,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      if (certificateChatRecording) {
        audioRecorder.stop().catch(() => {});
      }
    };
  }, [certificateChatRecording, audioRecorder]);

  useEffect(() => {
    loadPublicSettings(normalizedApiUrl || defaultApiUrl);
  }, [normalizedApiUrl]);

  useEffect(() => {
    if (!token || !isAdmin) {
      return;
    }

    loadAppSettings();
  }, [token, isAdmin, normalizedApiUrl]);

  useEffect(() => {
    if (token && isAdmin) {
      return;
    }

    setAppSettingsValues({
      ...DEFAULT_PUBLIC_SETTINGS,
      ...publicSettings,
      mobileAppDownloadUrl:
        String(publicSettings.mobileAppDownloadUrl || "").trim() ||
        getDefaultMobileDownloadUrl(normalizedApiUrl || defaultApiUrl),
    });
  }, [publicSettings, token, isAdmin, normalizedApiUrl]);

  useEffect(() => {
    if (!token) return;
    loadReferenceData();
    loadTickets("inbox", "");
    loadContacts("");
    syncCurrentSessionNotifications(false);
  }, [token]);

  useEffect(() => {
    if (!isAdmin && section === "certificates") {
      setSection("tickets");
    }
  }, [isAdmin, section]);

  useEffect(() => {
    if (!token) return;
    if (ticketView === "kanban") {
      loadKanbanTickets();
    } else {
      loadTickets(ticketView, ticketSearch);
    }
  }, [token, ticketView, ticketSearch, isAdmin, selectedKanbanPipelineId, pipelines]);

  useEffect(() => {
    if (section !== "tickets" || ticketView !== "inbox") {
      setInboxCertificateSummaries({});
      return;
    }

    loadInboxCertificateSummaries(tickets);
  }, [section, ticketView, tickets, token, isAdmin]);

  useEffect(() => {
    if (!token) return;
    loadContacts(contactSearch);
  }, [token, contactSearch]);

  useEffect(() => {
    if (!token || !isAdmin || section !== "certificates") return;

    if (certificateView === "orders") {
      loadCertificateOrders(certificateOrdersPage);
    }
  }, [
    token,
    isAdmin,
    section,
    certificateView,
    certificateOrderSearch,
    certificateDateRange.startDate,
    certificateDateRange.endDate,
  ]);

  useEffect(() => {
    if (!token || !isAdmin || section !== "certificates" || certificateView !== "create") {
      return;
    }

    loadCertificateProducts();
  }, [token, isAdmin, section, certificateView, requestedCertificatePersonType]);

  useEffect(() => {
    setContactCertificateOrders([]);
    setContactCertificateOrdersError("");
    setContactCertificateOrdersFetched(false);
    setSelectedContactPipelineId("");
    setSelectedContactStageId("");
  }, [selectedContact?.id]);

  useEffect(() => {
    if (!transferVisible) return;
    loadUsers(transferUserSearch);
  }, [transferVisible, transferUserSearch]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (showCertificateRealtime) {
        setShowCertificateRealtime(false);
        return true;
      }

      if (selectedContact) {
        setSelectedContact(null);
        return true;
      }

      if (selectedTicket) {
        if (recording) {
          audioRecorder.stop().catch(() => {});
          setRecording(false);
        }
        setSelectedTicket(null);
        setMessages([]);
        return true;
      }

      if (tagModalVisible) {
        setTagModalVisible(false);
        return true;
      }

      if (flowPickerVisible) {
        setFlowPickerVisible(false);
        return true;
      }

      if (transferVisible) {
        setTransferVisible(false);
        return true;
      }

      if (kanbanMoveVisible) {
        setKanbanMoveVisible(false);
        return true;
      }

      if (section !== "tickets") {
        setSection("tickets");
        return true;
      }

      if (section === "tickets" && ticketView !== "inbox") {
        setTicketView("inbox");
        return true;
      }

      if (section === "certificates" && certificateView !== "orders") {
        setCertificateView("orders");
        return true;
      }

      return false;
    });

    return () => subscription.remove();
  }, [
    audioRecorder,
    certificateView,
    flowPickerVisible,
    kanbanMoveVisible,
    recording,
    section,
    selectedContact,
    selectedTicket,
    showCertificateRealtime,
    tagModalVisible,
    ticketView,
    transferVisible,
  ]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", nextState => {
      const becameActive =
        /inactive|background/.test(appState) && nextState === "active";

      setAppState(nextState);

      if (becameActive && token) {
        refreshAppData();
        syncCurrentSessionNotifications(false);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [appState, token, section, ticketView, selectedTicket?.id]);

  useEffect(() => {
    if (!token) return;

    const interval = setInterval(() => {
      if (AppState.currentState !== "active") {
        return;
      }

      refreshAppData();
      syncCurrentSessionNotifications(true);
    }, FOREGROUND_REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [token, section, ticketView, selectedTicket?.id, appState]);

  if (!authReady && !token) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.centerState}>
          <ActivityIndicator color="#3f51b5" />
          <Text style={styles.helperText}>Restaurando sessao...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const principalMoveOptions = [
    {
      id: "principal-pending",
      label: "Aguardando",
      description: "Mover para a coluna de aguardando",
      kind: "principal-status",
      status: "pending",
    },
    {
      id: "principal-open",
      label: "Em atendimento",
      description: "Mover para a coluna de atendendo",
      kind: "principal-status",
      status: "open",
    },
    {
      id: "principal-closed",
      label: "Resolvido",
      description: "Mover para a coluna de resolvidas",
      kind: "principal-status",
      status: "closed",
    },
  ];

  if (!token) {
    return (
      <LoginScreen
        appName={appName}
        appLogoUrl={appLogoUrl}
        apiUrl={apiUrl}
        email={email}
        password={password}
        loading={authLoading}
        error={authError}
        currentVersion={APP_VERSION}
        latestVersion={latestMobileVersion}
        updateAvailable={updateAvailable}
        onUpdatePress={openAppUpdate}
        onChangeApiUrl={setApiUrl}
        onChangeEmail={setEmail}
        onChangePassword={setPassword}
        onSubmit={handleLogin}
      />
    );
  }

  if (selectedContact) {
    return (
      <>
        <ContactDetailScreen
          contact={selectedContact}
          error={contactDetailError}
          extraPipelines={extraContactPipelines}
          selectedExtraPipelineId={selectedContactPipelineId}
          selectedExtraStageId={selectedContactStageId}
          contactPipelineSaving={contactPipelineSaving}
          certificateOrders={contactCertificateOrders}
          certificateOrdersLoading={contactCertificateOrdersLoading}
          certificateOrdersError={contactCertificateOrdersError}
          certificateOrdersFetched={contactCertificateOrdersFetched}
          onBack={() => setSelectedContact(null)}
          onRefresh={() => loadContact(selectedContact.id)}
          onOpenTags={() => {
            setTagTarget("contact");
            setTagIds(uniqueIds((selectedContact.tags || []).map(tag => tag.id)));
            setTagModalVisible(true);
          }}
          onStartConversation={() => startConversationFromContact(selectedContact)}
          onLoadCertificateOrders={() =>
            loadCertificateOrdersForContact(selectedContact.id)
          }
          onSelectExtraPipeline={pipelineId => {
            setSelectedContactPipelineId(String(pipelineId));
            setSelectedContactStageId("");
          }}
          onSelectExtraStage={stageId => setSelectedContactStageId(String(stageId))}
          onAddExtraPipeline={addContactToExtraPipeline}
          onMoveExtraPipelineStage={moveContactExtraPipelineStage}
          onRemoveExtraPipeline={removeContactFromExtraPipeline}
        />

        <TagModal
          visible={tagModalVisible}
          title="Etiquetas do contato"
          tags={tags}
          selectedIds={tagIds}
          saving={tagSaving}
          onToggle={tagId => setTagIds(current => toggleId(current, tagId))}
          onClose={() => setTagModalVisible(false)}
          onSave={saveTags}
        />
      </>
    );
  }

  if (selectedTicket) {
    return (
      <>
        <TicketDetailScreen
          ticket={selectedTicket}
          messages={messages}
          draft={draft}
          loading={messagesLoading}
          sending={sending}
          recording={recording}
          error={messagesError}
          onBack={() => {
            if (recording) {
              audioRecorder.stop().catch(() => {});
              setRecording(false);
            }
            setSelectedTicket(null);
            setMessages([]);
          }}
          onChangeDraft={setDraft}
          onSend={sendMessage}
          onPickImage={handlePickImage}
          onPickFile={handlePickFile}
          onToggleRecording={handleToggleRecording}
          onRefresh={refreshCurrentTicket}
          onAccept={() =>
            updateTicket({ status: "open", userId: user?.id || null })
          }
          onReturn={() => updateTicket({ status: "pending", userId: null })}
          onResolve={() =>
            updateTicket({
              status: "closed",
              userId: selectedTicket?.userId || user?.id || null,
            })
          }
          onReopen={() => updateTicket({ status: "open", userId: user?.id || null })}
          onOpenTransfer={() => {
            setSelectedTransferUserId(selectedTicket?.userId || "");
            setSelectedTransferQueueId(selectedTicket?.queueId || "");
            setTransferVisible(true);
          }}
          onOpenContact={async () => {
            if (!selectedTicket?.contact?.id) {
              return;
            }
            setSelectedContact(selectedTicket.contact);
            await loadContact(selectedTicket.contact?.id);
          }}
          onCreateCertificateOrder={openCreateOrderFromTicket}
          onOpenTags={() => {
            setTagTarget("ticket");
            setTagIds(uniqueIds((selectedTicket.tags || []).map(tag => tag.id)));
            setTagModalVisible(true);
          }}
          onOpenFlow={() => setFlowPickerVisible(true)}
          onOpenKanbanMove={() => {
            setKanbanMovePipelineId(
              selectedTicket?.pipelineId || principalPipeline?.id || "",
            );
            setKanbanMoveVisible(true);
          }}
        />

        <TransferModal
          visible={transferVisible}
          userSearch={transferUserSearch}
          userOptions={userOptions}
          queues={queues}
          selectedUserId={selectedTransferUserId}
          selectedQueueId={selectedTransferQueueId}
          saving={transferSaving}
          onClose={() => setTransferVisible(false)}
          onChangeUserSearch={setTransferUserSearch}
          onSelectUser={setSelectedTransferUserId}
          onSelectQueue={setSelectedTransferQueueId}
          onSave={saveTransfer}
        />

        <PickerModal
          visible={flowPickerVisible}
          title="Enviar fluxo"
          items={flows.map(flow => ({
            id: flow.id,
            label: flow.name,
            description: flow.description || "Sem descricao",
          }))}
          onClose={() => setFlowPickerVisible(false)}
          onSelect={item => runFlow(item.id)}
        />

        <Modal
          visible={kanbanMoveVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setKanbanMoveVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Mover status do ticket</Text>
              <Text style={styles.helperText}>
                O ticket continua no fluxo principal. Pipelines paralelos são do contato.
              </Text>
              <ScrollView style={styles.modalList}>
                {principalMoveOptions.map(stage => (
                  <Pressable
                    key={stage.id}
                    onPress={() => moveToStage(stage)}
                    style={styles.modalOption}
                  >
                    <Text style={styles.modalOptionTitle}>{stage.label}</Text>
                    <Text style={styles.modalOptionText}>
                      {stage.description}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <ActionButton label="Fechar" onPress={() => setKanbanMoveVisible(false)} />
            </View>
          </View>
        </Modal>

        <TagModal
          visible={tagModalVisible}
          title="Etiquetas do ticket"
          tags={tags}
          selectedIds={tagIds}
          saving={tagSaving}
          onToggle={tagId => setTagIds(current => toggleId(current, tagId))}
          onClose={() => setTagModalVisible(false)}
          onSave={saveTags}
        />

        <PickerModal
          visible={ticketCertificateOrderPickerVisible}
          title="Reaproveitar pedido"
          items={
            ticketCertificateOrderPickerLoading
              ? [
                  {
                    id: "loading",
                    label: "Carregando pedidos...",
                    description: "Aguarde um instante.",
                  },
                ]
              : ticketCertificateOrderPickerError
                ? [
                    {
                      id: "error",
                      label: "Falha ao carregar pedidos",
                      description: ticketCertificateOrderPickerError,
                    },
                  ]
                : ticketCertificateOrderPickerOrders.map(order => ({
                    id: order.identifier || order.protocol || Math.random(),
                    label: `${order.customerName || "Cliente"} • #${order.identifier || "-"}`,
                    description: `${order.protocol || "Sem protocolo"} • ${order.productName || "Sem produto"}`,
                    order,
                  }))
          }
          onClose={() => setTicketCertificateOrderPickerVisible(false)}
          onSelect={item => {
            if (item.order) {
              hydrateCreateOrderFromSelectedTicketOrder(item.order);
            }
          }}
        />
      </>
    );
  }

  return (
    <MainShell
      title={appName}
      subtitle={
        section === "tickets"
          ? `Tickets • ${ticketViews.find(item => item.key === ticketView)?.label || "Inbox"}`
          : section === "contacts"
            ? "Contatos"
            : section === "certificates"
              ? `Certificados • ${certificateViews.find(item => item.key === certificateView)?.label || "Pedidos"}`
              : "Configurações do app"
      }
      logoUrl={appLogoUrl}
      sections={availableSections}
      section={section}
      onChangeSection={setSection}
      onLogout={handleLogout}
    >
      {section === "tickets" ? (
        <TicketsHomeScreen
          view={ticketView}
          search={ticketSearch}
          tickets={tickets}
          inboxCertificateSummaries={inboxCertificateSummaries}
          loading={ticketsLoading}
          error={ticketsError}
          pipelines={pipelines}
          selectedKanbanPipelineId={selectedKanbanPipelineId}
          kanbanTickets={kanbanTickets}
          kanbanMemberships={kanbanContactMemberships}
          kanbanLoading={kanbanLoading}
          kanbanError={kanbanError}
          onChangeView={setTicketView}
          onChangeSearch={setTicketSearch}
          onChangeKanbanPipeline={pipelineId =>
            setSelectedKanbanPipelineId(String(pipelineId))
          }
          onRefreshTickets={() => loadTickets()}
          onRefreshKanban={loadKanbanTickets}
          onOpenTicket={openTicket}
          onOpenContact={async contact => {
            if (!contact?.id) return;
            setSelectedContact(contact);
            await loadContact(contact.id);
          }}
        />
      ) : section === "contacts" ? (
        <ContactsScreen
          search={contactSearch}
          contacts={contacts}
          loading={contactsLoading}
          error={contactsError}
          onChangeSearch={setContactSearch}
          onRefresh={() => loadContacts()}
          onOpenContact={async contact => {
            setSelectedContact(contact);
            await loadContact(contact.id);
          }}
        />
      ) : section === "certificates" ? (
        <View style={styles.flexOne}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.topTabs}
          >
            {certificateViews.map(item => (
              <Pressable
                key={item.key}
                onPress={() => setCertificateView(item.key)}
                style={[
                  styles.topTab,
                  certificateView === item.key && styles.topTabActive,
                ]}
              >
                <Text
                  style={[
                    styles.topTabText,
                    certificateView === item.key && styles.topTabTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {certificateView === "orders" ? (
            <CertificatesOrdersScreen
              search={certificateOrderSearch}
              onChangeSearch={value => {
                setCertificateOrderSearch(value);
                setCertificateOrdersPage(1);
              }}
              onRefresh={() => loadCertificateOrders(certificateOrdersPage)}
              orders={certificateOrders}
              loading={certificateOrdersLoading}
              error={certificateOrdersError}
              dateRange={certificateDateRange}
              onChangeDateRange={setCertificateDateRange}
              pagination={certificateOrdersPagination}
              onPrevPage={() => {
                if ((certificateOrdersPagination.page || 1) > 1) {
                  loadCertificateOrders((certificateOrdersPagination.page || 1) - 1);
                }
              }}
              onNextPage={() => {
                if (certificateOrdersPagination.hasNextPage) {
                  loadCertificateOrders((certificateOrdersPagination.page || 1) + 1);
                }
              }}
            />
          ) : certificateView === "create" ? (
            <CertificatesCreateScreen
              form={certificateCreateForm}
              onChangeForm={setCertificateCreateForm}
              error={certificateOrdersError}
              customerLookupLoading={certificateCustomerLookupLoading}
              customerLookupSummary={certificateCustomerLookupSummary}
              onLookupCustomer={() =>
                lookupCertificateCustomer(certificateCreateForm.document, {
                  force: true,
                })
              }
              requestedPersonType={requestedCertificatePersonType}
              productSelectorOpen={certificateProductSelectorOpen}
              onToggleProductSelector={() =>
                setCertificateProductSelectorOpen(current => !current)
              }
              products={certificateProducts}
              productsLoading={certificateProductsLoading}
              selectedProduct={selectedCertificateProduct}
              onSelectProduct={product => {
                setCertificateCreateForm(current => ({
                  ...current,
                  selectedProductKey: createProductKey(product),
                  productCode: product.productCode || "",
                  productName: product.productName || "",
                  certificateValue:
                    product.suggestedValue || current.certificateValue || "",
                }));
                setCertificateProductSelectorOpen(false);
              }}
              createLoading={certificateCreateLoading}
              createResponse={certificateCreateResponse}
              onSubmit={submitCertificateOrder}
            />
          ) : (
            <CertificatesChatScreen
              messages={certificateChatMessages}
              attachments={certificateChatAttachments}
              loading={certificateChatLoading}
              error={certificateOrdersError}
              input={certificateChatInput}
              onChangeInput={setCertificateChatInput}
              onSend={sendCertificateChatMessage}
              onPickPdf={pickCertificateChatPdf}
              onPickImage={pickCertificateChatImage}
              onPickAudio={pickCertificateChatAudio}
              onToggleRecording={toggleCertificateChatRecording}
              recording={certificateChatRecording}
              onRemoveAttachment={index =>
                setCertificateChatAttachments(current =>
                  current.filter((_, itemIndex) => itemIndex !== index),
                )
              }
              onClear={clearCertificateChat}
              showRealtime={showCertificateRealtime}
              onToggleRealtime={() =>
                setShowCertificateRealtime(current => !current)
              }
              realtimeWebViewRef={certificateRealtimeWebViewRef}
              onRealtimeMessage={handleCertificateRealtimeWebViewMessage}
              onRealtimeError={syntheticEvent =>
                setCertificateOrdersError(
                  syntheticEvent.nativeEvent?.description ||
                    "Falha ao carregar a tela de voz.",
                )
              }
            />
          )}
        </View>
      ) : (
        <ConfigScreen
          appName={appName}
          appLogoUrl={appLogoUrl}
          currentVersion={APP_VERSION}
          latestVersion={latestMobileVersion}
          updateAvailable={updateAvailable}
          downloadUrl={mobileDownloadUrl}
          isAdmin={isAdmin}
          values={appSettingsValues}
          loading={appSettingsLoading}
          saving={appSettingsSaving}
          error={appSettingsError}
          onChangeValue={handleChangeAppSetting}
          onSave={saveAppSettings}
          onOpenUpdate={openAppUpdate}
          onRefresh={() => {
            loadPublicSettings(normalizedApiUrl || defaultApiUrl);
            loadAppSettings();
          }}
        />
      )}
    </MainShell>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#eef2f7",
  },
  flexOne: {
    flex: 1,
  },
  loginShell: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    gap: 18,
  },
  brandAvatarShell: {
    alignSelf: "center",
    backgroundColor: "#3f51b5",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  brandAvatarText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    gap: 10,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a",
  },
  loginSubtitle: {
    color: "#64748b",
    lineHeight: 20,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#0f172a",
  },
  primaryButton: {
    backgroundColor: "#3f51b5",
    borderRadius: 12,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonSmall: {
    backgroundColor: "#3f51b5",
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  appBar: {
    backgroundColor: "#3f51b5",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  appBarTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
  },
  appBarSubtitle: {
    color: "#dbe5ff",
    fontSize: 13,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  bottomBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#dbe3ef",
    backgroundColor: "#ffffff",
    padding: 10,
    gap: 8,
  },
  bottomTab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#eef2ff",
  },
  bottomTabActive: {
    backgroundColor: "#3f51b5",
  },
  bottomTabText: {
    color: "#3f51b5",
    fontWeight: "700",
  },
  bottomTabTextActive: {
    color: "#ffffff",
  },
  topTabs: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  topTabsCompactShell: {
    paddingTop: 10,
    paddingBottom: 2,
  },
  topTabsCompact: {
    gap: 8,
    paddingBottom: 4,
  },
  topTab: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#e2e8f0",
  },
  topTabCompact: {
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  topTabActive: {
    backgroundColor: "#3f51b5",
  },
  topTabText: {
    color: "#334155",
    fontWeight: "700",
  },
  topTabTextCompact: {
    fontSize: 12,
  },
  topTabTextActive: {
    color: "#ffffff",
  },
  screenContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 24,
  },
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  toolbarText: {
    color: "#64748b",
    fontWeight: "600",
  },
  helperText: {
    color: "#64748b",
    lineHeight: 20,
  },
  errorText: {
    color: "#b91c1c",
    lineHeight: 20,
  },
  updateNotice: {
    backgroundColor: "#eef2ff",
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  updateNoticeTitle: {
    color: "#1e3a8a",
    fontWeight: "700",
    fontSize: 16,
  },
  updateNoticeText: {
    color: "#334155",
    lineHeight: 20,
  },
  ticketCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    gap: 8,
    shadowColor: "#0f172a",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  contactCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    gap: 6,
  },
  ticketIdentity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0,
  },
  ticketTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  ticketName: {
    flex: 1,
    color: "#0f172a",
    fontSize: 16,
    fontWeight: "700",
  },
  ticketMeta: {
    color: "#64748b",
    fontSize: 13,
  },
  ticketSnippet: {
    color: "#334155",
    lineHeight: 20,
  },
  ticketBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timeText: {
    color: "#94a3b8",
    fontSize: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusOpen: {
    backgroundColor: "#dcfce7",
  },
  statusPending: {
    backgroundColor: "#fef3c7",
  },
  statusClosed: {
    backgroundColor: "#e2e8f0",
  },
  statusBadgeText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  badgeTextFilled: {
    color: "#ffffff",
  },
  avatarShell: {
    backgroundColor: "#dbeafe",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarFallbackText: {
    color: "#1e3a8a",
    fontWeight: "700",
    fontSize: 16,
  },
  configPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  badgesWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  emptyTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "700",
  },
  emptyText: {
    color: "#64748b",
    lineHeight: 20,
  },
  centerState: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    color: "#0f172a",
    fontSize: 18,
    fontWeight: "700",
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  contactPipelineCard: {
    borderWidth: 1,
    borderColor: "#dbe3ef",
    borderRadius: 14,
    padding: 12,
    gap: 10,
    backgroundColor: "#f8fafc",
  },
  contactPipelineHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  contactPipelineTitle: {
    flex: 1,
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "700",
  },
  contactPipelineRemoveButton: {
    borderWidth: 1,
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  contactPipelineRemoveButtonText: {
    color: "#b91c1c",
    fontWeight: "700",
    fontSize: 12,
  },
  contactPipelineStageButton: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  contactPipelineStageButtonText: {
    color: "#334155",
    fontWeight: "700",
    fontSize: 12,
  },
  contactPipelineStageButtonTextActive: {
    color: "#ffffff",
  },
  contactPipelineComposer: {
    gap: 10,
    marginTop: 4,
  },
  actionButton: {
    borderWidth: 1,
    borderColor: "#c7d2fe",
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  actionButtonPrimary: {
    backgroundColor: "#3f51b5",
    borderColor: "#3f51b5",
  },
  actionButtonText: {
    color: "#334155",
    fontWeight: "700",
  },
  actionButtonTextPrimary: {
    color: "#ffffff",
  },
  ticketActionPanel: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  messagesList: {
    gap: 10,
  },
  messageBubble: {
    maxWidth: "88%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    gap: 6,
  },
  messageBubbleOther: {
    alignSelf: "flex-start",
    backgroundColor: "#f8fafc",
  },
  messageBubbleMine: {
    alignSelf: "flex-end",
    backgroundColor: "#3f51b5",
  },
  messageText: {
    color: "#0f172a",
    lineHeight: 20,
  },
  messageTextMine: {
    color: "#ffffff",
  },
  audioCard: {
    gap: 10,
  },
  audioCardMine: {
    alignItems: "flex-end",
  },
  audioCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  audioButton: {
    borderRadius: 999,
    backgroundColor: "#e0e7ff",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  audioButtonMine: {
    backgroundColor: "rgba(255, 255, 255, 0.18)",
  },
  audioButtonText: {
    color: "#1e3a8a",
    fontWeight: "700",
  },
  audioButtonTextMine: {
    color: "#ffffff",
  },
  audioMetaText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
  },
  audioMetaTextMine: {
    color: "#dbe5ff",
  },
  audioProgressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 999,
    backgroundColor: "#dbe3ef",
    overflow: "hidden",
  },
  audioProgressTrackMine: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  audioProgressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#3f51b5",
  },
  audioProgressFillMine: {
    backgroundColor: "#ffffff",
  },
  mediaImageShell: {
    borderRadius: 14,
    overflow: "hidden",
  },
  mediaImage: {
    width: 220,
    height: 220,
    borderRadius: 14,
    backgroundColor: "#e2e8f0",
  },
  mediaFileCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dbe3ef",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  mediaFileCardMine: {
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  mediaFileName: {
    color: "#0f172a",
    fontWeight: "700",
  },
  mediaFileNameMine: {
    color: "#ffffff",
  },
  mediaFileAction: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "600",
  },
  mediaFileActionMine: {
    color: "#dbe5ff",
  },
  messageTime: {
    color: "#64748b",
    fontSize: 11,
  },
  messageTimeMine: {
    color: "#dbe5ff",
  },
  composerShell: {
    borderTopWidth: 1,
    borderTopColor: "#dbe3ef",
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  composerShellInset: {
    gap: 10,
  },
  composerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  composerIconButton: {
    minWidth: 74,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#c7d2fe",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  composerIconButtonActive: {
    backgroundColor: "#fee2e2",
    borderColor: "#fca5a5",
  },
  composerIconGlyph: {
    fontSize: 18,
  },
  composerIconGlyphActive: {
    color: "#b91c1c",
  },
  composerIconLabel: {
    color: "#3f51b5",
    fontWeight: "700",
    fontSize: 12,
  },
  composerIconLabelActive: {
    color: "#b91c1c",
  },
  composer: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-end",
  },
  composerInput: {
    flex: 1,
    minHeight: 48,
    maxHeight: 140,
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#0f172a",
  },
  secondaryButtonSmall: {
    borderRadius: 999,
    minHeight: 38,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#c7d2fe",
  },
  secondaryButtonText: {
    color: "#3f51b5",
    fontWeight: "700",
  },
  recordingButtonSmall: {
    borderRadius: 999,
    minHeight: 38,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fee2e2",
    borderWidth: 1,
    borderColor: "#fca5a5",
  },
  recordingButtonText: {
    color: "#b91c1c",
    fontWeight: "700",
  },
  chatMessages: {
    gap: 10,
  },
  chatBubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    maxWidth: "92%",
  },
  chatBubbleAssistant: {
    alignSelf: "flex-start",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#dbe3ef",
  },
  chatBubbleUser: {
    alignSelf: "flex-end",
    backgroundColor: "#e0e7ff",
  },
  chatBubbleRole: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
  },
  chatBubbleText: {
    color: "#0f172a",
    lineHeight: 20,
  },
  chatTrace: {
    gap: 3,
  },
  chatTraceText: {
    color: "#64748b",
    fontSize: 12,
    lineHeight: 18,
  },
  attachmentPillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  attachmentPill: {
    borderRadius: 999,
    backgroundColor: "#eef2ff",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  attachmentPillText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  chatComposer: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  chatRealtimePanel: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#dbe3ef",
    paddingTop: 16,
    gap: 10,
  },
  chatActionRail: {
    position: "absolute",
    right: 14,
    bottom: 14,
    gap: 10,
  },
  chatFabButton: {
    minWidth: 86,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#0f172a",
    alignItems: "center",
    shadowColor: "#0f172a",
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  chatFabButtonActive: {
    backgroundColor: "#3f51b5",
  },
  chatFabButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  chatFabButtonTextActive: {
    color: "#ffffff",
  },
  realtimeWebviewCardInline: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#ffffff",
    minHeight: 420,
    borderWidth: 1,
    borderColor: "#dbe3ef",
  },
  realtimeWebview: {
    flex: 1,
    backgroundColor: "#ffffff",
    minHeight: 420,
  },
  kanbanRow: {
    flexDirection: "row",
    gap: 14,
  },
  kanbanColumn: {
    width: 310,
    gap: 10,
  },
  kanbanHeader: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  kanbanHeaderText: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
    flex: 1,
  },
  kanbanHeaderCount: {
    color: "#ffffff",
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    gap: 12,
    maxHeight: "82%",
  },
  modalTitle: {
    color: "#0f172a",
    fontSize: 20,
    fontWeight: "700",
  },
  modalSectionTitle: {
    color: "#334155",
    fontWeight: "700",
  },
  modalList: {
    maxHeight: 240,
  },
  modalListSmall: {
    maxHeight: 160,
  },
  modalOption: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 4,
  },
  modalOptionActive: {
    backgroundColor: "#e0e7ff",
  },
  modalOptionTitle: {
    color: "#0f172a",
    fontWeight: "700",
  },
  modalOptionText: {
    color: "#64748b",
    lineHeight: 18,
  },
  certStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  certStatusApproved: {
    backgroundColor: "#dcfce7",
  },
  certStatusPending: {
    backgroundColor: "#fef3c7",
  },
  certStatusOther: {
    backgroundColor: "#e2e8f0",
  },
  certStatusBadgeText: {
    color: "#334155",
    fontSize: 12,
    fontWeight: "700",
  },
  orderDetailSection: {
    gap: 4,
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  selectorHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  selectorBody: {
    gap: 10,
  },
  selectorList: {
    maxHeight: 280,
  },
  selectorOption: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  selectorOptionActive: {
    backgroundColor: "#e0e7ff",
    borderColor: "#3f51b5",
  },
  sectionLabel: {
    color: "#334155",
    fontWeight: "700",
  },
  doubleInputRow: {
    flexDirection: "row",
    gap: 10,
  },
  doubleInput: {
    flex: 1,
  },
  streetInput: {
    flex: 1,
  },
  numberInput: {
    width: 90,
  },
  inlineActionInput: {
    marginBottom: 0,
  },
  readonlyInput: {
    backgroundColor: "#f8fafc",
    color: "#64748b",
  },
});

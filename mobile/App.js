import Constants from "expo-constants";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

const defaultApiUrl =
  process.env.EXPO_PUBLIC_API_URL ||
  Constants.expoConfig?.extra?.apiUrl ||
  "https://api-whaticket.digiyou.com.br";

const sections = [
  { key: "tickets", label: "Tickets" },
  { key: "contacts", label: "Contatos" },
];

const ticketViews = [
  { key: "inbox", label: "Inbox" },
  { key: "open", label: "Atendendo" },
  { key: "pending", label: "Aguardando" },
  { key: "closed", label: "Resolvidas" },
  { key: "kanban", label: "Kanban" },
];

function normalizeApiUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
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

function buildHeaders(token, extra = {}) {
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function apiFetch(apiUrl, path, options = {}, token) {
  const response = await fetch(`${normalizeApiUrl(apiUrl)}${path}`, {
    ...options,
    headers: buildHeaders(token, options.headers || {}),
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

function LoginScreen({
  apiUrl,
  email,
  password,
  loading,
  error,
  onChangeApiUrl,
  onChangeEmail,
  onChangePassword,
  onSubmit,
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <KeyboardAvoidingView
        style={styles.loginShell}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>W</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.loginTitle}>Whaticket</Text>
          <Text style={styles.loginSubtitle}>
            Login do mesmo backend usado no painel web.
          </Text>

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

function MainShell({ title, subtitle, section, onChangeSection, onLogout, children }) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.appBar}>
        <View style={styles.flexOne}>
          <Text style={styles.appBarTitle}>{title}</Text>
          <Text style={styles.appBarSubtitle}>{subtitle}</Text>
        </View>
        <ActionButton label="Sair" onPress={onLogout} />
      </View>

      <View style={styles.content}>{children}</View>

      <View style={styles.bottomBar}>
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

function TicketCard({ ticket, onPress }) {
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
      </View>
    </Pressable>
  );
}

function TicketsHomeScreen({
  view,
  search,
  tickets,
  loading,
  error,
  principalPipeline,
  kanbanTickets,
  kanbanLoading,
  kanbanError,
  onChangeView,
  onChangeSearch,
  onRefreshTickets,
  onRefreshKanban,
  onOpenTicket,
}) {
  const visibleStages = principalPipeline?.stages || [];

  return (
    <View style={styles.flexOne}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.topTabs}
      >
        {ticketViews.map(item => (
          <Pressable
            key={item.key}
            onPress={() => onChangeView(item.key)}
            style={[
              styles.topTab,
              view === item.key && styles.topTabActive,
            ]}
          >
            <Text
              style={[
                styles.topTabText,
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
            <View style={styles.toolbar}>
              <Text style={styles.toolbarText}>
                {principalPipeline?.name || "Kanban principal"}
              </Text>
              <ActionButton label="Atualizar" onPress={onRefreshKanban} />
            </View>
            <Text style={styles.helperText}>
              Kanban principal atrelado aos tickets. Os demais kanbans continuam
              disponiveis no detalhe do ticket.
            </Text>
            {kanbanError ? <Text style={styles.errorText}>{kanbanError}</Text> : null}
          </View>

          {kanbanLoading ? (
            <View style={styles.centerState}>
              <ActivityIndicator color="#3f51b5" />
            </View>
          ) : visibleStages.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.kanbanRow}>
                {visibleStages.map(stage => {
                  const stageTickets = kanbanTickets.filter(
                    ticket => String(ticket.kanbanStageId) === String(stage.id),
                  );

                  return (
                    <View key={stage.id} style={styles.kanbanColumn}>
                      <View
                        style={[
                          styles.kanbanHeader,
                          { backgroundColor: stage.color || "#3f51b5" },
                        ]}
                      >
                        <Text style={styles.kanbanHeaderText}>{stage.name}</Text>
                        <Text style={styles.kanbanHeaderCount}>
                          {stageTickets.length}
                        </Text>
                      </View>

                      {stageTickets.length ? (
                        stageTickets.map(ticket => (
                          <TicketCard
                            key={ticket.id}
                            ticket={ticket}
                            onPress={() => onOpenTicket(ticket)}
                          />
                        ))
                      ) : (
                        <View style={styles.card}>
                          <Text style={styles.emptyText}>Sem tickets.</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          ) : (
            <View style={styles.card}>
              <Text style={styles.emptyTitle}>Kanban indisponivel</Text>
              <Text style={styles.emptyText}>
                Nenhum pipeline principal configurado.
              </Text>
            </View>
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

function TicketDetailScreen({
  ticket,
  messages,
  draft,
  loading,
  sending,
  error,
  onBack,
  onChangeDraft,
  onSend,
  onRefresh,
  onAccept,
  onReturn,
  onResolve,
  onReopen,
  onOpenTransfer,
  onOpenContact,
  onOpenTags,
  onOpenFlow,
  onOpenKanbanMove,
}) {
  const showAccept = ticket?.status === "pending";
  const showReturn = ticket?.status === "open";
  const showResolve = ticket?.status === "open";
  const showReopen = ticket?.status === "closed";

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.appBar}>
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
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.screenContent}>
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
                <ActionButton label="Assumir" primary onPress={onAccept} />
              ) : null}
              {showReturn ? <ActionButton label="Devolver" onPress={onReturn} /> : null}
              {showResolve ? (
                <ActionButton label="Resolver" primary onPress={onResolve} />
              ) : null}
              {showReopen ? (
                <ActionButton label="Reabrir" primary onPress={onReopen} />
              ) : null}
              <ActionButton label="Transferir" onPress={onOpenTransfer} />
            </View>

            <View style={styles.actionsRow}>
              <ActionButton label="Contato" onPress={onOpenContact} />
              <ActionButton label="Etiquetas" onPress={onOpenTags} />
              <ActionButton label="Enviar fluxo" onPress={onOpenFlow} />
              <ActionButton label="Mover kanban" onPress={onOpenKanbanMove} />
              <ActionButton label="Atualizar" onPress={onRefresh} />
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
                    <Text
                      style={[
                        styles.messageText,
                        message.fromMe && styles.messageTextMine,
                      ]}
                    >
                      {message.body || "[mensagem sem texto]"}
                    </Text>
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

        <View style={styles.composer}>
          <TextInput
            style={styles.composerInput}
            placeholder="Digite uma mensagem"
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
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ContactDetailScreen({
  contact,
  error,
  onBack,
  onRefresh,
  onOpenTags,
}) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.appBar}>
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

      <ScrollView contentContainerStyle={styles.screenContent}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Dados</Text>
          <Text style={styles.helperText}>Nome: {contact?.name || "-"}</Text>
          <Text style={styles.helperText}>Numero: {contact?.number || "-"}</Text>
          <Text style={styles.helperText}>Email: {contact?.email || "-"}</Text>
          <View style={styles.actionsRow}>
            <ActionButton label="Atualizar" onPress={onRefresh} />
            <ActionButton label="Etiquetas" onPress={onOpenTags} />
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
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

export default function App() {
  const [apiUrl, setApiUrl] = useState(defaultApiUrl);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [user, setUser] = useState(null);

  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [section, setSection] = useState("tickets");
  const [ticketView, setTicketView] = useState("inbox");
  const [ticketSearch, setTicketSearch] = useState("");
  const [tickets, setTickets] = useState([]);
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

  const [selectedContact, setSelectedContact] = useState(null);
  const [contactDetailError, setContactDetailError] = useState("");

  const [tags, setTags] = useState([]);
  const [flows, setFlows] = useState([]);
  const [pipelines, setPipelines] = useState([]);
  const [queues, setQueues] = useState([]);
  const [userOptions, setUserOptions] = useState([]);

  const [kanbanTickets, setKanbanTickets] = useState([]);
  const [kanbanLoading, setKanbanLoading] = useState(false);
  const [kanbanError, setKanbanError] = useState("");

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
  const principalPipeline = useMemo(
    () => getPrincipalPipeline(pipelines),
    [pipelines],
  );
  const currentMovePipeline =
    pipelines.find(p => String(p.id) === String(kanbanMovePipelineId)) ||
    principalPipeline;

  async function loadReferenceData(currentToken = token) {
    if (!currentToken) return;

    const [tagsData, flowsData, pipelinesData, queuesData, usersData] =
      await Promise.all([
        apiFetch(normalizedApiUrl, "/tags", {}, currentToken),
        apiFetch(normalizedApiUrl, "/flows", {}, currentToken),
        apiFetch(normalizedApiUrl, "/kanban-pipelines", {}, currentToken),
        apiFetch(normalizedApiUrl, "/queue", {}, currentToken),
        apiFetch(normalizedApiUrl, "/users?pageNumber=1", {}, currentToken),
      ]);

    setTags(Array.isArray(tagsData) ? tagsData : []);
    setFlows(Array.isArray(flowsData) ? flowsData : []);
    setPipelines(Array.isArray(pipelinesData) ? pipelinesData : []);
    setQueues(Array.isArray(queuesData) ? queuesData : []);
    setUserOptions(usersData?.users || []);
  }

  async function loadUsers(searchParam = "") {
    if (!token) return;

    try {
      const params = new URLSearchParams({ pageNumber: "1" });
      if (searchParam.trim()) {
        params.set("searchParam", searchParam.trim());
      }

      const payload = await apiFetch(
        normalizedApiUrl,
        `/users?${params.toString()}`,
        {},
        token,
      );
      setUserOptions(payload.users || []);
    } catch (_error) {}
  }

  async function loadTickets(view = ticketView, search = ticketSearch) {
    if (!token) return;

    setTicketsLoading(true);
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

      const payload = await apiFetch(
        normalizedApiUrl,
        `/tickets?${params.toString()}`,
        {},
        token,
      );
      setTickets(payload.tickets || []);
    } catch (error) {
      setTicketsError(error.message);
    } finally {
      setTicketsLoading(false);
    }
  }

  async function loadKanbanTickets() {
    if (!token || !principalPipeline?.id) return;

    setKanbanLoading(true);
    setKanbanError("");

    try {
      const params = new URLSearchParams({
        pageNumber: "1",
        showAll: "true",
        pipelineId: String(principalPipeline.id),
      });

      const payload = await apiFetch(
        normalizedApiUrl,
        `/tickets?${params.toString()}`,
        {},
        token,
      );
      setKanbanTickets(payload.tickets || []);
    } catch (error) {
      setKanbanError(error.message);
    } finally {
      setKanbanLoading(false);
    }
  }

  async function loadContacts(search = contactSearch) {
    if (!token) return;

    setContactsLoading(true);
    setContactsError("");

    try {
      const params = new URLSearchParams({ pageNumber: "1" });
      if (search.trim()) {
        params.set("searchParam", search.trim());
      }
      const payload = await apiFetch(
        normalizedApiUrl,
        `/contacts?${params.toString()}`,
        {},
        token,
      );
      setContacts(payload.contacts || []);
    } catch (error) {
      setContactsError(error.message);
    } finally {
      setContactsLoading(false);
    }
  }

  async function loadTicketDetail(ticketId) {
    if (!token || !ticketId) return;

    try {
      const payload = await apiFetch(normalizedApiUrl, `/tickets/${ticketId}`, {}, token);
      setSelectedTicket(payload);
      setKanbanMovePipelineId(payload.pipelineId || principalPipeline?.id || "");
    } catch (error) {
      setMessagesError(error.message);
    }
  }

  async function loadMessages(ticketId) {
    if (!token || !ticketId) return;

    setMessagesLoading(true);
    setMessagesError("");

    try {
      const payload = await apiFetch(
        normalizedApiUrl,
        `/messages/${ticketId}?pageNumber=1`,
        {},
        token,
      );
      setMessages(payload.messages || []);
    } catch (error) {
      setMessagesError(error.message);
    } finally {
      setMessagesLoading(false);
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
      const payload = await apiFetch(normalizedApiUrl, `/contacts/${contactId}`, {}, token);
      setSelectedContact(payload);
    } catch (error) {
      setContactDetailError(error.message);
    }
  }

  async function handleLogin() {
    setAuthLoading(true);
    setAuthError("");

    try {
      const payload = await apiFetch(normalizedApiUrl, "/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      setToken(payload.token);
      setUser(payload.user);
      setSection("tickets");
      setTicketView("inbox");
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
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
      await apiFetch(
        normalizedApiUrl,
        `/tickets/${selectedTicket.id}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
        token,
      );
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
      await apiFetch(
        normalizedApiUrl,
        `/messages/${selectedTicket.id}`,
        {
          method: "POST",
          body: JSON.stringify({ body: draft.trim() }),
        },
        token,
      );
      setDraft("");
      await refreshCurrentTicket();
    } catch (error) {
      setMessagesError(error.message);
    } finally {
      setSending(false);
    }
  }

  async function updateContact(contactId, payload) {
    setTagSaving(true);
    setContactDetailError("");

    try {
      await apiFetch(
        normalizedApiUrl,
        `/contacts/${contactId}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
        token,
      );
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

      await apiFetch(
        normalizedApiUrl,
        `/tickets/${selectedTicket.id}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
        token,
      );
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
      await apiFetch(
        normalizedApiUrl,
        `/flows/${flowId}/run/${selectedTicket.id}`,
        { method: "POST" },
        token,
      );
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

  useEffect(() => {
    if (!token) return;
    loadReferenceData();
    loadTickets("inbox", "");
    loadContacts("");
  }, [token]);

  useEffect(() => {
    if (!token) return;
    if (ticketView === "kanban") {
      loadKanbanTickets();
    } else {
      loadTickets(ticketView, ticketSearch);
    }
  }, [token, ticketView, ticketSearch, principalPipeline?.id]);

  useEffect(() => {
    if (!token) return;
    loadContacts(contactSearch);
  }, [token, contactSearch]);

  useEffect(() => {
    if (!transferVisible) return;
    loadUsers(transferUserSearch);
  }, [transferVisible, transferUserSearch]);

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
        apiUrl={apiUrl}
        email={email}
        password={password}
        loading={authLoading}
        error={authError}
        onChangeApiUrl={setApiUrl}
        onChangeEmail={setEmail}
        onChangePassword={setPassword}
        onSubmit={handleLogin}
      />
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
          error={messagesError}
          onBack={() => {
            setSelectedTicket(null);
            setMessages([]);
          }}
          onChangeDraft={setDraft}
          onSend={sendMessage}
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
            setSection("contacts");
            await loadContact(selectedTicket.contact?.id);
          }}
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
              <Text style={styles.modalTitle}>Mover no kanban</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.topTabsCompact}
              >
                {pipelines.map(pipeline => (
                  <Pressable
                    key={pipeline.id}
                    onPress={() => setKanbanMovePipelineId(pipeline.id)}
                    style={[
                      styles.topTab,
                      String(kanbanMovePipelineId || principalPipeline?.id) ===
                        String(pipeline.id) && styles.topTabActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.topTabText,
                        String(kanbanMovePipelineId || principalPipeline?.id) ===
                          String(pipeline.id) && styles.topTabTextActive,
                      ]}
                    >
                      {pipeline.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <ScrollView style={styles.modalList}>
                {isPrincipalPipeline(currentMovePipeline)
                  ? principalMoveOptions.map(stage => (
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
                    ))
                  : (currentMovePipeline?.stages || []).map(stage => (
                      <Pressable
                        key={stage.id}
                        onPress={() => moveToStage(stage)}
                        style={styles.modalOption}
                      >
                        <Text style={styles.modalOptionTitle}>{stage.name}</Text>
                        <Text style={styles.modalOptionText}>
                          {currentMovePipeline?.name || "Kanban"}
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
      </>
    );
  }

  if (selectedContact) {
    return (
      <>
        <ContactDetailScreen
          contact={selectedContact}
          error={contactDetailError}
          onBack={() => setSelectedContact(null)}
          onRefresh={() => loadContact(selectedContact.id)}
          onOpenTags={() => {
            setTagTarget("contact");
            setTagIds(uniqueIds((selectedContact.tags || []).map(tag => tag.id)));
            setTagModalVisible(true);
          }}
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

  return (
    <MainShell
      title="Whaticket"
      subtitle={
        section === "tickets"
          ? `Tickets • ${ticketViews.find(item => item.key === ticketView)?.label || "Inbox"}`
          : "Contatos"
      }
      section={section}
      onChangeSection={setSection}
      onLogout={handleLogout}
    >
      {section === "tickets" ? (
        <TicketsHomeScreen
          view={ticketView}
          search={ticketSearch}
          tickets={tickets}
          loading={ticketsLoading}
          error={ticketsError}
          principalPipeline={principalPipeline}
          kanbanTickets={kanbanTickets}
          kanbanLoading={kanbanLoading}
          kanbanError={kanbanError}
          onChangeView={setTicketView}
          onChangeSearch={setTicketSearch}
          onRefreshTickets={() => loadTickets()}
          onRefreshKanban={loadKanbanTickets}
          onOpenTicket={openTicket}
        />
      ) : (
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
      )}
    </MainShell>
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
  logoCircle: {
    alignSelf: "center",
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#3f51b5",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    color: "#ffffff",
    fontSize: 34,
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
  topTabActive: {
    backgroundColor: "#3f51b5",
  },
  topTabText: {
    color: "#334155",
    fontWeight: "700",
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
  messageTime: {
    color: "#64748b",
    fontSize: 11,
  },
  messageTimeMine: {
    color: "#dbe5ff",
  },
  composer: {
    borderTopWidth: 1,
    borderTopColor: "#dbe3ef",
    backgroundColor: "#ffffff",
    padding: 12,
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
});

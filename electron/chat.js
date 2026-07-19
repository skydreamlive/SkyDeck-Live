const messagesElement = document.getElementById("messages");
const emptyStateElement = document.getElementById("emptyState");
const connectionStatusElement = document.getElementById("connectionStatus");
const scrollHintElement = document.getElementById("scrollHint");
const scrollToLatestButton = document.getElementById("scrollToLatest");
const settingsButton = document.getElementById("settingsButton");
const closeSettingsButton = document.getElementById("closeSettingsButton");
const settingsPanel = document.getElementById("settingsPanel");
const resetSettingsButton = document.getElementById("resetSettingsButton");

const controls = {
    showAvatars: document.getElementById("showAvatars"),
    showTime: document.getElementById("showTime"),
    showChat: document.getElementById("showChat"),
    showFollows: document.getElementById("showFollows"),
    showGifts: document.getElementById("showGifts"),
    showShares: document.getElementById("showShares"),
    showLikes: document.getElementById("showLikes"),
    showJoins: document.getElementById("showJoins"),
    fontSize: document.getElementById("fontSize"),
    backgroundOpacity: document.getElementById("backgroundOpacity"),
    maxMessages: document.getElementById("maxMessages")
};

const fontSizeValue = document.getElementById("fontSizeValue");
const backgroundOpacityValue = document.getElementById("backgroundOpacityValue");
const SETTINGS_KEY = "skydeck-chat-settings-v1";
const RECONNECT_DELAY_MS = 3000;
const BOTTOM_TOLERANCE = 48;

const DEFAULT_SETTINGS = {
    showAvatars: true,
    showTime: true,
    showChat: true,
    showFollows: true,
    showGifts: true,
    showShares: true,
    showLikes: true,
    showJoins: true,
    fontSize: 16,
    backgroundOpacity: 95,
    maxMessages: 100
};

let settings = loadSettings();
let socket = null;
let reconnectTimer = null;
let autoScrollEnabled = true;

function loadSettings() {
    try {
        const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
        return { ...DEFAULT_SETTINGS, ...(saved || {}) };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

function saveSettings() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function applySettings() {
    document.documentElement.style.setProperty("--chat-font-size", `${settings.fontSize}px`);
    document.documentElement.style.setProperty("--chat-bg-opacity", String(settings.backgroundOpacity / 100));
    fontSizeValue.textContent = `${settings.fontSize} px`;
    backgroundOpacityValue.textContent = `${settings.backgroundOpacity} %`;
    removeOldMessages();
}

function syncControls() {
    Object.entries(controls).forEach(([key, control]) => {
        if (control.type === "checkbox") control.checked = Boolean(settings[key]);
        else control.value = settings[key];
    });
    applySettings();
}

function firstNonEmpty(...values) {
    return values.find(value => typeof value === "string" && value.trim().length > 0)?.trim() || "";
}

function getEventType(event) {
    return String(event?.event || event?.type || event?.eventType || event?.data?.event || event?.data?.type || "").toLowerCase();
}

function getUsername(event) {
    return firstNonEmpty(event?.data?.nickname, event?.data?.uniqueId, event?.data?.username, event?.nickname, event?.uniqueId, event?.username) || "Passager";
}

function getAvatarUrl(event) {
    const data = event?.data || {};
    const user = data.user || event?.user || {};
    const avatarThumb = data.avatarThumb || user.avatarThumb || {};
    const avatarMedium = data.avatarMedium || user.avatarMedium || {};
    return firstNonEmpty(
        data.profilePictureUrl,
        data.profilePicture,
        data.avatar,
        data.avatarUrl,
        data.userAvatar,
        user.profilePictureUrl,
        user.avatarUrl,
        avatarThumb.urlList?.[0],
        avatarMedium.urlList?.[0],
        event?.profilePictureUrl,
        event?.avatarUrl
    );
}

function getComment(event) {
    return firstNonEmpty(event?.data?.comment, event?.data?.message, event?.data?.text, event?.comment, event?.message, event?.text);
}

function getGiftName(event) {
    return firstNonEmpty(event?.data?.giftName, event?.data?.gift?.name, event?.giftName) || "Cadeau";
}

function getGiftCount(event) {
    return Number(event?.data?.repeatCount || event?.data?.giftCount || event?.data?.count || event?.repeatCount || 1);
}

function normalizeEvent(event) {
    const rawType = getEventType(event);
    const username = getUsername(event);
    const avatarUrl = getAvatarUrl(event);

    if (["chat", "comment", "message"].includes(rawType)) {
        const comment = getComment(event);
        return comment ? { type: "chat", username, avatarUrl, text: comment } : null;
    }
    if (rawType === "follow") return { type: "follow", username, avatarUrl, text: "a rejoint les passagers de SkyDeck." };
    if (rawType === "gift") return { type: "gift", username, avatarUrl, text: `${getGiftName(event)} ×${getGiftCount(event)}` };
    if (rawType === "share") return { type: "share", username, avatarUrl, text: "a partagé le direct." };
    if (rawType === "like") return { type: "like", username, avatarUrl, text: "a aimé le direct." };
    if (["join", "member"].includes(rawType)) return { type: "join", username, avatarUrl, text: "vient d’arriver à bord." };
    return null;
}

function isTypeVisible(type) {
    const map = {
        chat: "showChat",
        follow: "showFollows",
        gift: "showGifts",
        share: "showShares",
        like: "showLikes",
        join: "showJoins"
    };
    return settings[map[type]] !== false;
}

function updateConnectionStatus(connected, text) {
    connectionStatusElement.textContent = text;
    connectionStatusElement.classList.toggle("connected", connected);
    connectionStatusElement.classList.toggle("disconnected", !connected);
}

function isNearBottom() {
    return (messagesElement.scrollHeight - messagesElement.scrollTop - messagesElement.clientHeight) <= BOTTOM_TOLERANCE;
}

function updateScrollControls() {
    scrollToLatestButton.hidden = autoScrollEnabled;
    scrollHintElement.textContent = autoScrollEnabled ? "Défilement automatique activé" : "Historique en consultation";
}

function scrollToLatest() {
    messagesElement.scrollTop = messagesElement.scrollHeight;
    autoScrollEnabled = true;
    updateScrollControls();
}

function removeOldMessages() {
    const messageElements = messagesElement.querySelectorAll(".message");
    const maxMessages = Math.max(25, Math.min(500, Number(settings.maxMessages) || 100));
    const excess = messageElements.length - maxMessages;
    for (let index = 0; index < excess; index += 1) messageElements[index].remove();
}

function initials(name) {
    return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join("") || "?";
}

function createAvatar(message) {
    if (!settings.showAvatars) return null;

    if (message.avatarUrl) {
        const image = document.createElement("img");
        image.className = "avatar";
        image.alt = "";
        image.referrerPolicy = "no-referrer";
        image.src = message.avatarUrl;
        image.addEventListener("error", () => image.replaceWith(createAvatarFallback(message.username)), { once: true });
        return image;
    }
    return createAvatarFallback(message.username);
}

function createAvatarFallback(username) {
    const fallback = document.createElement("div");
    fallback.className = "avatar avatar-fallback";
    fallback.textContent = initials(username);
    return fallback;
}

function addMessage(message) {
    if (!isTypeVisible(message.type)) return;
    emptyStateElement?.remove();

    const article = document.createElement("article");
    article.className = `message ${message.type}`;

    const avatar = createAvatar(message);
    const content = document.createElement("div");
    content.className = "message-content";

    const topLine = document.createElement("div");
    topLine.className = "message-topline";

    const author = document.createElement("div");
    author.className = "message-author";
    author.textContent = message.username;
    topLine.append(author);

    if (settings.showTime) {
        const time = document.createElement("time");
        time.className = "message-time";
        time.textContent = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date());
        topLine.append(time);
    }

    const text = document.createElement("div");
    text.className = "message-text";
    text.textContent = message.text;

    content.append(topLine, text);
    if (avatar) article.append(avatar);
    article.append(content);
    messagesElement.append(article);

    removeOldMessages();
    if (autoScrollEnabled) scrollToLatest();
}

function scheduleReconnect() {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connectTikFinity, RECONNECT_DELAY_MS);
}

function connectTikFinity() {
    const websocketUrl = window.SKYDECK_CONFIG?.websocketUrl;
    if (!websocketUrl) {
        updateConnectionStatus(false, "Adresse TikFinity absente");
        return;
    }
    if (socket && [WebSocket.OPEN, WebSocket.CONNECTING].includes(socket.readyState)) return;

    updateConnectionStatus(false, "Connexion…");
    socket = new WebSocket(websocketUrl);
    socket.addEventListener("open", () => updateConnectionStatus(true, "TikFinity connecté"));
    socket.addEventListener("message", messageEvent => {
        try {
            const normalized = normalizeEvent(JSON.parse(messageEvent.data));
            if (normalized) addMessage(normalized);
        } catch {
            // TikFinity peut aussi envoyer des trames non JSON.
        }
    });
    socket.addEventListener("close", () => {
        updateConnectionStatus(false, "Reconnexion…");
        scheduleReconnect();
    });
    socket.addEventListener("error", () => updateConnectionStatus(false, "TikFinity indisponible"));
}

messagesElement.addEventListener("scroll", () => {
    const nearBottom = isNearBottom();
    if (nearBottom) autoScrollEnabled = true;
    else if (autoScrollEnabled) autoScrollEnabled = false;
    updateScrollControls();
});

scrollToLatestButton.addEventListener("click", scrollToLatest);
settingsButton.addEventListener("click", () => { settingsPanel.hidden = !settingsPanel.hidden; });
closeSettingsButton.addEventListener("click", () => { settingsPanel.hidden = true; });

Object.entries(controls).forEach(([key, control]) => {
    control.addEventListener("input", () => {
        settings[key] = control.type === "checkbox" ? control.checked : Number(control.value);
        saveSettings();
        applySettings();
    });
});

resetSettingsButton.addEventListener("click", () => {
    settings = { ...DEFAULT_SETTINGS };
    saveSettings();
    syncControls();
});

window.addEventListener("beforeunload", () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (socket) socket.close();
});

syncControls();
updateScrollControls();
connectTikFinity();

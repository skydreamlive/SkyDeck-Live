const messagesElement =
    document.getElementById("messages");

const emptyStateElement =
    document.getElementById("emptyState");

const connectionStatusElement =
    document.getElementById("connectionStatus");

const scrollHintElement =
    document.getElementById("scrollHint");

const scrollToLatestButton =
    document.getElementById("scrollToLatest");

const MAX_MESSAGES = 100;
const RECONNECT_DELAY_MS = 3000;
const BOTTOM_TOLERANCE = 48;

let socket = null;
let reconnectTimer = null;
let autoScrollEnabled = true;


function firstNonEmpty(...values) {
    return values.find(value =>
        typeof value === "string" &&
        value.trim().length > 0
    )?.trim() || "";
}


function getEventType(event) {
    return String(
        event?.event ||
        event?.type ||
        event?.eventType ||
        event?.data?.event ||
        event?.data?.type ||
        ""
    ).toLowerCase();
}


function getUsername(event) {
    return firstNonEmpty(
        event?.data?.nickname,
        event?.data?.uniqueId,
        event?.data?.username,
        event?.nickname,
        event?.uniqueId,
        event?.username
    ) || "Passager";
}


function getComment(event) {
    return firstNonEmpty(
        event?.data?.comment,
        event?.data?.message,
        event?.data?.text,
        event?.comment,
        event?.message,
        event?.text
    );
}


function getGiftName(event) {
    return firstNonEmpty(
        event?.data?.giftName,
        event?.data?.gift?.name,
        event?.giftName
    ) || "Cadeau";
}


function getGiftCount(event) {
    return Number(
        event?.data?.repeatCount ||
        event?.data?.giftCount ||
        event?.data?.count ||
        event?.repeatCount ||
        1
    );
}


function normalizeEvent(event) {
    const rawType = getEventType(event);
    const username = getUsername(event);

    if (
        rawType === "chat" ||
        rawType === "comment" ||
        rawType === "message"
    ) {
        const comment = getComment(event);

        if (!comment) {
            return null;
        }

        return {
            type: "chat",
            username,
            text: comment
        };
    }

    if (rawType === "follow") {
        return {
            type: "follow",
            username,
            text: "a rejoint les passagers de SkyDeck."
        };
    }

    if (rawType === "gift") {
        return {
            type: "gift",
            username,
            text: `${getGiftName(event)} ×${getGiftCount(event)}`
        };
    }

    if (rawType === "share") {
        return {
            type: "share",
            username,
            text: "a partagé le direct."
        };
    }

    if (rawType === "like") {
        return {
            type: "like",
            username,
            text: "a aimé le direct."
        };
    }

    if (
        rawType === "join" ||
        rawType === "member"
    ) {
        return {
            type: "join",
            username,
            text: "vient d’arriver à bord."
        };
    }

    return null;
}


function updateConnectionStatus(
    connected,
    text
) {
    connectionStatusElement.textContent = text;
    connectionStatusElement.classList.toggle(
        "connected",
        connected
    );
    connectionStatusElement.classList.toggle(
        "disconnected",
        !connected
    );
}


function isNearBottom() {
    return (
        messagesElement.scrollHeight -
        messagesElement.scrollTop -
        messagesElement.clientHeight
    ) <= BOTTOM_TOLERANCE;
}


function updateScrollControls() {
    scrollToLatestButton.hidden =
        autoScrollEnabled;

    scrollHintElement.textContent =
        autoScrollEnabled
            ? "Défilement automatique activé"
            : "Historique en consultation";
}


function scrollToLatest() {
    messagesElement.scrollTop =
        messagesElement.scrollHeight;

    autoScrollEnabled = true;
    updateScrollControls();
}


function removeOldMessages() {
    const messageElements =
        messagesElement.querySelectorAll(
            ".message"
        );

    const excess =
        messageElements.length -
        MAX_MESSAGES;

    for (
        let index = 0;
        index < excess;
        index += 1
    ) {
        messageElements[index].remove();
    }
}


function addMessage(message) {
    if (emptyStateElement) {
        emptyStateElement.remove();
    }

    const article =
        document.createElement("article");

    article.className =
        `message ${message.type}`;

    const topLine =
        document.createElement("div");

    topLine.className =
        "message-topline";

    const author =
        document.createElement("div");

    author.className =
        "message-author";

    author.textContent =
        message.username;

    const time =
        document.createElement("time");

    time.className =
        "message-time";

    time.textContent =
        new Intl.DateTimeFormat(
            "fr-FR",
            {
                hour: "2-digit",
                minute: "2-digit"
            }
        ).format(new Date());

    const text =
        document.createElement("div");

    text.className =
        "message-text";

    text.textContent =
        message.text;

    topLine.append(author, time);
    article.append(topLine, text);
    messagesElement.append(article);

    removeOldMessages();

    if (autoScrollEnabled) {
        scrollToLatest();
    }
}


function scheduleReconnect() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
    }

    reconnectTimer = setTimeout(
        connectTikFinity,
        RECONNECT_DELAY_MS
    );
}


function connectTikFinity() {
    const websocketUrl =
        window.SKYDECK_CONFIG?.websocketUrl;

    if (!websocketUrl) {
        updateConnectionStatus(
            false,
            "Adresse TikFinity absente"
        );

        return;
    }

    if (
        socket &&
        (
            socket.readyState === WebSocket.OPEN ||
            socket.readyState === WebSocket.CONNECTING
        )
    ) {
        return;
    }

    updateConnectionStatus(
        false,
        "Connexion…"
    );

    socket = new WebSocket(websocketUrl);

    socket.addEventListener(
        "open",
        () => {
            updateConnectionStatus(
                true,
                "TikFinity connecté"
            );
        }
    );

    socket.addEventListener(
        "message",
        messageEvent => {
            let event;

            try {
                event = JSON.parse(
                    messageEvent.data
                );
            } catch {
                return;
            }

            const normalized =
                normalizeEvent(event);

            if (normalized) {
                addMessage(normalized);
            }
        }
    );

    socket.addEventListener(
        "close",
        () => {
            updateConnectionStatus(
                false,
                "Reconnexion…"
            );

            scheduleReconnect();
        }
    );

    socket.addEventListener(
        "error",
        () => {
            updateConnectionStatus(
                false,
                "TikFinity indisponible"
            );
        }
    );
}


messagesElement.addEventListener(
    "scroll",
    () => {
        const nearBottom =
            isNearBottom();

        if (nearBottom) {
            autoScrollEnabled = true;
        } else if (autoScrollEnabled) {
            autoScrollEnabled = false;
        }

        updateScrollControls();
    }
);


scrollToLatestButton.addEventListener(
    "click",
    scrollToLatest
);


window.addEventListener(
    "beforeunload",
    () => {
        if (reconnectTimer) {
            clearTimeout(reconnectTimer);
        }

        if (socket) {
            socket.close();
        }
    }
);


updateScrollControls();
connectTikFinity();

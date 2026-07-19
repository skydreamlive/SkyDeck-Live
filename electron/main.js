const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const {
    app,
    BrowserWindow,
    ipcMain,
    shell,
    dialog,
    screen
} = require("electron");

const {
    launchProgram
} = require("./launcher");

const {
    getProgramStatuses,
    closeProgram
} = require("./processManager");

const {
    getProgramsList,
    getProgram,
    replacePrograms
} = require("./programs");

const {
    savePrograms
} = require("./config");

const TikTok =
    require("./services/tiktok");


/* ===========================
   CACHE ELECTRON
=========================== */

const userDataPath = path.join(
    process.env.APPDATA || app.getPath("appData"),
    "SkyDeckLive"
);

app.setPath("userData", userDataPath);

app.commandLine.appendSwitch(
    "disk-cache-dir",
    path.join(userDataPath, "Cache")
);


/* ===========================
   SERVEUR LOCAL OVERLAY
=========================== */

const OVERLAY_HOST = "127.0.0.1";
const OVERLAY_PORT = 3210;

let overlayServer = null;

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg"
};


function sendJson(
    response,
    statusCode,
    payload
) {
    response.writeHead(
        statusCode,
        {
            "Content-Type":
                "application/json; charset=utf-8",

            "Cache-Control":
                "no-store",

            "Access-Control-Allow-Origin":
                "*"
        }
    );

    response.end(
        JSON.stringify(payload)
    );
}


function resolveOverlayFile(
    requestPath
) {
    const normalizedPath =
        requestPath === "/"
            ? "/index.html"
            : requestPath;

    let decodedPath;

    try {
        decodedPath = decodeURIComponent(
            normalizedPath.split("?")[0]
        );
    } catch (_error) {
        return null;
    }

    const relativePath =
        decodedPath.replace(/^\/+/, "");

    /*
     * Les fichiers de l’overlay principal (index.html, js, css...)
     * sont à la racine du projet, tandis que les ressources Electron
     * sont stockées dans electron/assets.
     */
    const rootDirectory =
        relativePath === "assets" ||
        relativePath.startsWith("assets/")
            ? __dirname
            : path.resolve(__dirname, "..");

    const filePath = path.resolve(
        rootDirectory,
        relativePath
    );

    const allowedRoot =
        path.resolve(rootDirectory);

    const relativeToRoot =
        path.relative(allowedRoot, filePath);

    if (
        relativeToRoot.startsWith("..") ||
        path.isAbsolute(relativeToRoot)
    ) {
        return null;
    }

    return filePath;
}


async function handleOverlayRequest(
    request,
    response
) {
    const requestUrl =
        new URL(
            request.url,
            `http://${OVERLAY_HOST}:${OVERLAY_PORT}`
        );

    if (
        requestUrl.pathname ===
        "/api/tiktok/followers"
    ) {
        try {
            if (!TikTok.isConnected()) {
                sendJson(
                    response,
                    200,
                    {
                        success: true,
                        connected: false,
                        followerCount: null
                    }
                );

                return;
            }

            const followerCount =
                await TikTok
                    .getFollowerCount();

            sendJson(
                response,
                200,
                {
                    success: true,
                    connected: true,
                    followerCount
                }
            );
        } catch (error) {
            console.error(
                "Erreur API locale TikTok :",
                error
            );

            sendJson(
                response,
                500,
                {
                    success: false,
                    connected:
                        TikTok.isConnected(),
                    followerCount: null,
                    message: error.message
                }
            );
        }

        return;
    }

    const filePath =
        resolveOverlayFile(
            requestUrl.pathname
        );

    if (
        !filePath ||
        !fs.existsSync(filePath) ||
        !fs.statSync(filePath).isFile()
    ) {
        response.writeHead(
            404,
            {
                "Content-Type":
                    "text/plain; charset=utf-8"
            }
        );

        response.end(
            "Fichier introuvable."
        );

        return;
    }

    const extension =
        path.extname(filePath)
            .toLowerCase();

    response.writeHead(
        200,
        {
            "Content-Type":
                MIME_TYPES[extension] ||
                "application/octet-stream",

            "Cache-Control":
                extension === ".html" ||
                extension === ".js" ||
                extension === ".css"
                    ? "no-store"
                    : "public, max-age=3600"
        }
    );

    fs.createReadStream(filePath)
        .pipe(response);
}


function startOverlayServer() {
    if (overlayServer) {
        return Promise.resolve();
    }

    return new Promise(
        (
            resolve,
            reject
        ) => {
            const server =
                http.createServer(
                    (
                        request,
                        response
                    ) => {
                        handleOverlayRequest(
                            request,
                            response
                        ).catch(error => {
                            console.error(
                                "Erreur serveur Overlay :",
                                error
                            );

                            if (
                                !response
                                    .headersSent
                            ) {
                                response.writeHead(
                                    500,
                                    {
                                        "Content-Type":
                                            "text/plain; charset=utf-8"
                                    }
                                );
                            }

                            response.end(
                                "Erreur interne SkyDeck."
                            );
                        });
                    }
                );

            server.once(
                "error",
                error => {
                    if (
                        error.code ===
                        "EADDRINUSE"
                    ) {
                        reject(
                            new Error(
                                `Le port ${OVERLAY_PORT} est déjà utilisé.`
                            )
                        );

                        return;
                    }

                    reject(error);
                }
            );

            server.listen(
                OVERLAY_PORT,
                OVERLAY_HOST,
                () => {
                    overlayServer =
                        server;

                    console.log(
                        `Overlay disponible sur http://${OVERLAY_HOST}:${OVERLAY_PORT}/`
                    );

                    resolve();
                }
            );
        }
    );
}


function stopOverlayServer() {
    if (!overlayServer) {
        return;
    }

    overlayServer.close();
    overlayServer = null;
}


/* ===========================
   FENÊTRES
=========================== */

let dashboardWindow = null;
let overlayWindow = null;
let settingsWindow = null;
let chatWindow = null;

const CHAT_DEFAULT_BOUNDS = {
    width: 430,
    height: 650
};

let chatBoundsSaveTimer = null;


/* ===========================
   CACHE DES ICÔNES
=========================== */

const programIconCache = new Map();

const customIconsDirectory = path.join(
    __dirname,
    "assets",
    "program-icons"
);


/* ===========================
   FENÊTRE PRINCIPALE
=========================== */

function createDashboardWindow() {
    dashboardWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        minWidth: 1000,
        minHeight: 650,
        title: "SkyDeck Live",
        backgroundColor: "#081018",

        webPreferences: {
            preload: path.join(
                __dirname,
                "preload.js"
            ),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    dashboardWindow.loadFile(
        path.join(
            __dirname,
            "dashboard.html"
        )
    );

    dashboardWindow.on(
        "closed",
        () => {
            dashboardWindow = null;
        }
    );
}


/* ===========================
   OVERLAY
=========================== */

function createOverlayWindow() {
    if (
        overlayWindow &&
        !overlayWindow.isDestroyed()
    ) {
        overlayWindow.show();
        overlayWindow.focus();

        return {
            success: true,
            alreadyRunning: true,
            message: "Overlay déjà ouvert."
        };
    }

    overlayWindow = new BrowserWindow({
        width: 800,
        height: 600,
        title: "SkyDeck Live Overlay",
        backgroundColor: "#081018",
        show: true,

        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    overlayWindow.loadURL(
        `http://${OVERLAY_HOST}:${OVERLAY_PORT}/`
    );

    overlayWindow.on(
        "closed",
        () => {
            overlayWindow = null;
        }
    );

    return {
        success: true,
        alreadyRunning: false,
        message: "Overlay ouvert."
    };
}


/* ===========================
   CHAT TIKTOK FLOTTANT
=========================== */

function getChatBoundsFilePath() {
    return path.join(
        app.getPath("userData"),
        "chat-window-bounds.json"
    );
}


function isBoundsVisible(bounds) {
    if (!bounds) {
        return false;
    }

    return screen
        .getAllDisplays()
        .some(display => {
            const area = display.workArea;

            return (
                bounds.x < area.x + area.width - 80 &&
                bounds.x + bounds.width > area.x + 80 &&
                bounds.y < area.y + area.height - 60 &&
                bounds.y + bounds.height > area.y + 40
            );
        });
}


function loadChatBounds() {
    try {
        const filePath =
            getChatBoundsFilePath();

        if (!fs.existsSync(filePath)) {
            return CHAT_DEFAULT_BOUNDS;
        }

        const savedBounds = JSON.parse(
            fs.readFileSync(filePath, "utf8")
        );

        if (!isBoundsVisible(savedBounds)) {
            return CHAT_DEFAULT_BOUNDS;
        }

        return {
            x: Number(savedBounds.x),
            y: Number(savedBounds.y),
            width: Math.max(
                320,
                Number(savedBounds.width) ||
                    CHAT_DEFAULT_BOUNDS.width
            ),
            height: Math.max(
                360,
                Number(savedBounds.height) ||
                    CHAT_DEFAULT_BOUNDS.height
            )
        };
    } catch (error) {
        console.error(
            "Lecture de la position du chat impossible :",
            error
        );

        return CHAT_DEFAULT_BOUNDS;
    }
}


function saveChatBounds() {
    if (
        !chatWindow ||
        chatWindow.isDestroyed() ||
        chatWindow.isMinimized()
    ) {
        return;
    }

    try {
        const filePath =
            getChatBoundsFilePath();

        fs.mkdirSync(
            path.dirname(filePath),
            { recursive: true }
        );

        fs.writeFileSync(
            filePath,
            JSON.stringify(
                chatWindow.getBounds(),
                null,
                2
            ),
            "utf8"
        );
    } catch (error) {
        console.error(
            "Enregistrement de la position du chat impossible :",
            error
        );
    }
}


function scheduleChatBoundsSave() {
    if (chatBoundsSaveTimer) {
        clearTimeout(chatBoundsSaveTimer);
    }

    chatBoundsSaveTimer = setTimeout(
        saveChatBounds,
        250
    );
}


function createChatWindow() {
    if (
        chatWindow &&
        !chatWindow.isDestroyed()
    ) {
        if (chatWindow.isMinimized()) {
            chatWindow.restore();
        }

        chatWindow.show();
        chatWindow.moveTop();

        return {
            success: true,
            alreadyRunning: true,
            message: "Chat TikTok déjà ouvert."
        };
    }

    const savedBounds = loadChatBounds();

    chatWindow = new BrowserWindow({
        ...savedBounds,
        minWidth: 320,
        minHeight: 360,
        title: "SkyDeck Live - Chat TikTok",
        backgroundColor: "#081018",
        alwaysOnTop: true,
        movable: true,
        resizable: true,
        minimizable: true,
        maximizable: false,
        fullscreenable: false,
        autoHideMenuBar: true,
        show: false,

        webPreferences: {
            preload: path.join(
                __dirname,
                "preload.js"
            ),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    chatWindow.setAlwaysOnTop(
        true,
        "screen-saver"
    );

    chatWindow.loadFile(
        path.join(
            __dirname,
            "chat.html"
        )
    );

    chatWindow.once(
        "ready-to-show",
        () => {
            if (
                chatWindow &&
                !chatWindow.isDestroyed()
            ) {
                chatWindow.show();
            }
        }
    );

    chatWindow.on(
        "move",
        scheduleChatBoundsSave
    );

    chatWindow.on(
        "resize",
        scheduleChatBoundsSave
    );

    chatWindow.on(
        "close",
        saveChatBounds
    );

    chatWindow.on(
        "closed",
        () => {
            chatWindow = null;
        }
    );

    return {
        success: true,
        alreadyRunning: false,
        message: "Chat TikTok ouvert."
    };
}


/* ===========================
   PARAMÈTRES
=========================== */

function createSettingsWindow() {
    if (
        settingsWindow &&
        !settingsWindow.isDestroyed()
    ) {
        settingsWindow.show();
        settingsWindow.focus();

        return {
            success: true
        };
    }

    settingsWindow = new BrowserWindow({
        width: 950,
        height: 720,
        resizable: false,
        title: "SkyDeck Live - Paramètres",
        backgroundColor: "#081018",
        parent: dashboardWindow,

        webPreferences: {
            preload: path.join(
                __dirname,
                "preload.js"
            ),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    settingsWindow.loadFile(
        path.join(
            __dirname,
            "settings.html"
        )
    );

    settingsWindow.on(
        "closed",
        () => {
            settingsWindow = null;
        }
    );

    return {
        success: true
    };
}


/* ===========================
   ICÔNES PERSONNALISÉES
=========================== */

function getCustomIconPath(programId) {
    const supportedExtensions = [
        "png",
        "jpg",
        "jpeg",
        "webp"
    ];

    for (
        const extension
        of supportedExtensions
    ) {
        const candidatePath = path.join(
            customIconsDirectory,
            `${programId}.${extension}`
        );

        if (fs.existsSync(candidatePath)) {
            return candidatePath;
        }
    }

    return null;
}


function fileToDataUrl(filePath) {
    const extension =
        path.extname(filePath)
            .toLowerCase()
            .replace(".", "");

    const mimeTypes = {
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        webp: "image/webp"
    };

    const mimeType =
        mimeTypes[extension] ||
        "application/octet-stream";

    const data =
        fs.readFileSync(filePath);

    return (
        `data:${mimeType};base64,` +
        data.toString("base64")
    );
}


/* ===========================
   ICÔNES DES PROGRAMMES
=========================== */

async function getProgramIcon(programId) {
    const program = getProgram(programId);

    if (!program) {
        return {
            success: false,
            iconDataUrl: null,
            source: null,
            message: "Programme inconnu."
        };
    }

    const cacheKey =
        `${program.id}:${program.path || ""}`;

    if (programIconCache.has(cacheKey)) {
        return {
            success: true,
            iconDataUrl:
                programIconCache.get(cacheKey),
            source: "cache"
        };
    }

    try {
        const customIconPath =
            getCustomIconPath(program.id);

        if (customIconPath) {
            const iconDataUrl =
                fileToDataUrl(
                    customIconPath
                );

            programIconCache.set(
                cacheKey,
                iconDataUrl
            );

            return {
                success: true,
                iconDataUrl,
                source: "custom"
            };
        }

        if (
            !program.path ||
            program.useShellApp
        ) {
            return {
                success: true,
                iconDataUrl: null,
                source: "fallback"
            };
        }

        const icon =
            await app.getFileIcon(
                program.path,
                {
                    size: "large"
                }
            );

        if (icon.isEmpty()) {
            return {
                success: true,
                iconDataUrl: null,
                source: "fallback"
            };
        }

        const iconDataUrl =
            icon.toDataURL();

        programIconCache.set(
            cacheKey,
            iconDataUrl
        );

        return {
            success: true,
            iconDataUrl,
            source: "windows"
        };
    } catch (error) {
        console.warn(
            `Icône indisponible pour ${program.name} :`,
            error.message
        );

        return {
            success: true,
            iconDataUrl: null,
            source: "fallback"
        };
    }
}


/* ===========================
   VALIDATION DE CONFIGURATION
=========================== */

function cleanPrograms(programs) {
    if (!Array.isArray(programs)) {
        throw new Error(
            "La configuration doit être une liste."
        );
    }

    const cleanedPrograms =
        programs.map(program => ({
            ...program,

            id: String(
                program.id || ""
            ).trim(),

            name: String(
                program.name || ""
            ).trim(),

            path: program.path
                ? String(program.path).trim()
                : "",

            processNames:
                Array.isArray(
                    program.processNames
                )
                    ? program.processNames
                        .map(name =>
                            String(name).trim()
                        )
                        .filter(Boolean)
                    : []
        }));

    const invalidProgram =
        cleanedPrograms.find(
            program =>
                !program.id ||
                !program.name ||
                (
                    !program.useShellApp &&
                    !program.path
                )
        );

    if (invalidProgram) {
        throw new Error(
            "Un logiciel contient des informations incomplètes."
        );
    }

    const ids =
        cleanedPrograms.map(
            program => program.id
        );

    if (
        new Set(ids).size !== ids.length
    ) {
        throw new Error(
            "Deux logiciels utilisent le même identifiant."
        );
    }

    return cleanedPrograms;
}


/* ===========================
   DÉMARRAGE ELECTRON
=========================== */

app.whenReady().then(
    async () => {
        try {
            await startOverlayServer();
        } catch (error) {
            console.error(
                "Impossible de démarrer le serveur Overlay :",
                error
            );

            dialog.showErrorBox(
                "SkyDeck Live",
                error.message
            );
        }

        ipcMain.handle(
            "launch-overlay",
            async () => {
                return createOverlayWindow();
            }
        );

        ipcMain.handle(
            "open-chat",
            async () => {
                return createChatWindow();
            }
        );

        ipcMain.handle(
            "open-settings",
            async () => {
                return createSettingsWindow();
            }
        );

        ipcMain.handle(
            "launch-program",
            async (_event, programId) => {
                return await launchProgram(
                    programId
                );
            }
        );

        ipcMain.handle(
            "close-program",
            async (_event, programId) => {
                return await closeProgram(
                    programId
                );
            }
        );

        ipcMain.handle(
            "get-program-statuses",
            async () => {
                return await getProgramStatuses(
                    overlayWindow
                );
            }
        );

        ipcMain.handle(
            "get-program-icon",
            async (_event, programId) => {
                return await getProgramIcon(
                    programId
                );
            }
        );

        ipcMain.handle(
            "open-restream",
            async () => {
                try {
                    await shell.openExternal(
                        "https://restream.io/channel"
                    );

                    return {
                        success: true,
                        message: "Restream ouvert."
                    };
                } catch (error) {
                    console.error(
                        "Erreur ouverture Restream :",
                        error
                    );

                    return {
                        success: false,
                        message:
                            "Impossible d’ouvrir Restream."
                    };
                }
            }
        );

        ipcMain.handle(
            "get-programs",
            async () => {
                return {
                    success: true,
                    programs:
                        getProgramsList()
                };
            }
        );

        ipcMain.handle(
            "browse-program",
            async (
                _event,
                currentPath = ""
            ) => {
                const result =
                    await dialog
                        .showOpenDialog(
                            settingsWindow ||
                            dashboardWindow,
                            {
                                title:
                                    "Choisir un programme",

                                defaultPath:
                                    currentPath ||
                                    undefined,

                                properties: [
                                    "openFile"
                                ],

                                filters: [
                                    {
                                        name:
                                            "Programmes Windows",

                                        extensions: [
                                            "exe",
                                            "bat",
                                            "cmd"
                                        ]
                                    },
                                    {
                                        name:
                                            "Tous les fichiers",

                                        extensions: ["*"]
                                    }
                                ]
                            }
                        );

                if (
                    result.canceled ||
                    result.filePaths.length ===
                        0
                ) {
                    return {
                        success: false,
                        canceled: true
                    };
                }

                const selectedPath =
                    result.filePaths[0];

                return {
                    success: true,
                    path: selectedPath,

                    processName:
                        path.basename(
                            selectedPath
                        ),

                    suggestedName:
                        path.basename(
                            selectedPath,
                            path.extname(
                                selectedPath
                            )
                        )
                };
            }
        );

        ipcMain.handle(
            "save-programs",
            async (_event, programs) => {
                try {
                    const cleanedPrograms =
                        cleanPrograms(programs);

                    savePrograms(
                        cleanedPrograms
                    );

                    replacePrograms(
                        cleanedPrograms
                    );

                    programIconCache.clear();

                    return {
                        success: true,
                        message:
                            "Configuration enregistrée."
                    };
                } catch (error) {
                    console.error(
                        "Erreur enregistrement programmes :",
                        error
                    );

                    return {
                        success: false,
                        message:
                            error.message
                    };
                }
            }
        );


        /* ===========================
           TIKTOK
        =========================== */

        ipcMain.handle(
            "tiktok-status",
            async () => {
                try {
                    const connected =
                        TikTok.isConnected();

                    if (!connected) {
                        return {
                            success: true,
                            connected: false,
                            displayName: "",
                            followerCount: null
                        };
                    }

                    const account =
                        await TikTok
                            .getAccountInfo();

                    return {
                        success: true,
                        connected: true,
                        displayName:
                            account.displayName,
                        followerCount:
                            account.followerCount
                    };
                } catch (error) {
                    console.error(
                        "Erreur statut TikTok :",
                        error
                    );

                    return {
                        success: false,
                        connected:
                            TikTok.isConnected(),
                        followerCount: null,
                        message:
                            error.message
                    };
                }
            }
        );

        ipcMain.handle(
            "tiktok-connect",
            async () => {
                try {
                    await TikTok.connect();

                    const account =
                        await TikTok
                            .getAccountInfo();

                    return {
                        success: true,
                        connected: true,
                        displayName:
                            account.displayName,
                        followerCount:
                            account.followerCount,
                        message:
                            "TikTok connecté."
                    };
                } catch (error) {
                    console.error(
                        "Erreur connexion TikTok :",
                        error
                    );

                    return {
                        success: false,
                        connected: false,
                        followerCount: null,
                        message:
                            error.message
                    };
                }
            }
        );

        ipcMain.handle(
            "tiktok-disconnect",
            async () => {
                try {
                    await TikTok.disconnect();

                    return {
                        success: true,
                        connected: false,
                        followerCount: null,
                        message:
                            "TikTok déconnecté."
                    };
                } catch (error) {
                    console.error(
                        "Erreur déconnexion TikTok :",
                        error
                    );

                    return {
                        success: false,
                        connected:
                            TikTok.isConnected(),
                        followerCount: null,
                        message:
                            error.message
                    };
                }
            }
        );

        ipcMain.handle(
            "tiktok-followers",
            async () => {
                try {
                    const followerCount =
                        await TikTok
                            .getFollowerCount();

                    return {
                        success: true,
                        connected: true,
                        followerCount
                    };
                } catch (error) {
                    console.error(
                        "Erreur abonnés TikTok :",
                        error
                    );

                    return {
                        success: false,
                        connected:
                            TikTok.isConnected(),
                        followerCount: null,
                        message:
                            error.message
                    };
                }
            }
        );


        createDashboardWindow();

        app.on(
            "activate",
            () => {
                if (
                    BrowserWindow
                        .getAllWindows()
                        .length === 0
                ) {
                    createDashboardWindow();
                }
            }
        );
    }
);


app.on(
    "before-quit",
    () => {
        stopOverlayServer();
    }
);


app.on(
    "window-all-closed",
    () => {
        if (
            process.platform !== "darwin"
        ) {
            app.quit();
        }
    }
);

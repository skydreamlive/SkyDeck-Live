const {
    contextBridge,
    ipcRenderer
} = require("electron");

contextBridge.exposeInMainWorld(
    "skyDeckAPI",
    {
        launchOverlay: () =>
            ipcRenderer.invoke(
                "launch-overlay"
            ),

        openSettings: () =>
            ipcRenderer.invoke(
                "open-settings"
            ),

        openChat: () =>
            ipcRenderer.invoke(
                "open-chat"
            ),

        launchProgram: programId =>
            ipcRenderer.invoke(
                "launch-program",
                programId
            ),

        closeProgram: programId =>
            ipcRenderer.invoke(
                "close-program",
                programId
            ),

        getProgramStatuses: () =>
            ipcRenderer.invoke(
                "get-program-statuses"
            ),

        getProgramIcon: programId =>
            ipcRenderer.invoke(
                "get-program-icon",
                programId
            ),

        openRestream: () =>
            ipcRenderer.invoke(
                "open-restream"
            ),

        getPrograms: () =>
            ipcRenderer.invoke(
                "get-programs"
            ),

        browseProgram: currentPath =>
            ipcRenderer.invoke(
                "browse-program",
                currentPath
            ),

        savePrograms: programs =>
            ipcRenderer.invoke(
                "save-programs",
                programs
            ),

        tiktok: {
            getStatus: () =>
                ipcRenderer.invoke(
                    "tiktok-status"
                ),

            connect: () =>
                ipcRenderer.invoke(
                    "tiktok-connect"
                ),

            disconnect: () =>
                ipcRenderer.invoke(
                    "tiktok-disconnect"
                ),

            getFollowers: () =>
                ipcRenderer.invoke(
                    "tiktok-followers"
                )
        },

        twitch: {
            getStatus: () =>
                ipcRenderer.invoke(
                    "twitch-status"
                ),

            connect: () =>
                ipcRenderer.invoke(
                    "twitch-connect"
                ),

            disconnect: () =>
                ipcRenderer.invoke(
                    "twitch-disconnect"
                ),

            refresh: () =>
                ipcRenderer.invoke(
                    "twitch-refresh"
                ),

            getFollowers: () =>
                ipcRenderer.invoke(
                    "twitch-followers"
                )
        }
    }
);
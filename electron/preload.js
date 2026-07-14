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
            )
    }
);
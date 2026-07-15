window.SKYDECK_CONFIG = {
    websocketUrl: "ws://localhost:21213/",
    alertDuration: 4000,
    testMode: false,

    volume: 0.5,

    /*
     * Valeur de secours uniquement.
     * Au démarrage, SkyDeck tente de la
     * remplacer par le compteur TikTok réel.
     */
    currentFollowers: 2275,

    previousGoal: 2000,
    nextGoal: 3000,
    goalStep: 1000,

    followerSyncUrl:
        "/api/tiktok/followers"
};

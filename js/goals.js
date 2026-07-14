function updateFollowerGoal(currentFollowers) {
    const previousGoal =
        window.SKYDECK_CONFIG.previousGoal;

    const nextGoal =
        window.SKYDECK_CONFIG.nextGoal;

    const totalDistance =
        nextGoal - previousGoal;

    const completedDistance =
        currentFollowers - previousGoal;

    const rawPercent =
        totalDistance > 0
            ? (completedDistance / totalDistance) * 100
            : 0;

    const percent =
        Math.max(0, Math.min(100, rawPercent));

    const remaining =
        Math.max(0, nextGoal - currentFollowers);

    currentFollowersElement.textContent =
        currentFollowers.toLocaleString("fr-FR");

    goalFollowersElement.textContent =
        nextGoal.toLocaleString("fr-FR");

    goalRemainingElement.textContent =
        `${remaining.toLocaleString("fr-FR")} passagers avant fermeture des portes`;

    goalProgressElement.style.width =
        `${percent}%`;

    goalPlaneElement.style.left =
        `${percent}%`;

    goalPercentElement.textContent =
        `${Math.floor(percent)} %`;

    checkGoalReached(currentFollowers);
}

function showGoalThanks(completedGoal) {
    const board =
        document.getElementById("goalThanks");

    const flight =
        document.getElementById("thanksFlight");

    if (!board || !flight) {
        return Promise.resolve();
    }

    flight.textContent =
        "VOL TERMINÉ - NOUVEL EMBARQUEMENT";

    board.classList.remove("show");

    void board.offsetWidth;

    board.classList.add("show");
    board.setAttribute("aria-hidden", "false");

    return new Promise(resolve => {
        setTimeout(() => {
            board.classList.remove("show");
            board.setAttribute("aria-hidden", "true");
            resolve();
        }, 4000);
    });
}

let goalTransitionInProgress = false;

async function checkGoalReached(currentFollowers) {

    if (goalTransitionInProgress) {
        return;
    }

    const nextGoal =
        window.SKYDECK_CONFIG.nextGoal;

    if (currentFollowers < nextGoal) {
        return;
    }

    goalTransitionInProgress = true;

    console.log("Objectif atteint !");
    await showGoalThanks(); 
    playTakeoffSound();
    await startTakeoffAnimation(() => {
    window.SKYDECK_CONFIG.previousGoal =
        nextGoal;

    window.SKYDECK_CONFIG.nextGoal +=
        window.SKYDECK_CONFIG.goalStep;

    updateFollowerGoal(currentFollowers);
});
    /* ICI on affichera le tableau */


    updateFollowerGoal(currentFollowers);

    goalTransitionInProgress = false;

}
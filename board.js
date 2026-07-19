async function showGoalBoard(completedGoal) {
    const board =
        document.getElementById("goalBoard");

    const flight =
        document.getElementById("boardFlight");

    if (!board || !flight) {
        return;
    }

    flight.textContent =
        `VOL SD${completedGoal}`;

    board.classList.add("show");

    await new Promise(resolve => {
        setTimeout(resolve, 4000);
    });

    board.classList.remove("show");

    await new Promise(resolve => {
        setTimeout(resolve, 450);
    });
}

function hideGoalBoard() {
    const board =
        document.getElementById("goalBoard");

    if (board) {
        board.classList.remove("show");
    }
}
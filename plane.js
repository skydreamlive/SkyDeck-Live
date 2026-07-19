function startTakeoffAnimation(prepareNextFlight) {
    const planeImage =
        document.getElementById("planeImage");

    if (!planeImage) {
        return Promise.resolve();
    }

    const animation = planeImage.animate(
        [
            {
                transform:
                    "translateY(-18px) translateX(0) scale(1) rotate(0deg)",
                opacity:1,
                offset:0
            },
            {
                transform:
                    "translateY(-18px) translateX(55px) scale(1) rotate(0deg)",
                opacity:1,
                offset:.25
            },
            {
                transform:
                    "translateY(-45px) translateX(130px) scale(.88) rotate(-8deg)",
                opacity:1,
                offset:.55
            },
            {
                transform:
                    "translateY(-140px) translateX(260px) scale(.48) rotate(-18deg)",
                opacity:0,
                offset:1
            }
        ],
        {
            duration:2200,
            easing:"cubic-bezier(.25,.65,.35,1)",
            fill:"forwards"
        }
    );

   return animation.finished
    .catch(() => {})
    .then(async () => {

        animation.cancel();

        /* L'avion est hors champ */
        planeImage.style.opacity = "0";

        /* Petite pause */
        await new Promise(resolve =>
            setTimeout(resolve, 7000)
        );
if (typeof prepareNextFlight === "function") {
    prepareNextFlight();
}
        /* Il revient très loin */
        planeImage.style.transition = "none";

        planeImage.style.transform =
            "translateY(-90px) translateX(-220px) scale(.35)";

        planeImage.style.opacity = "1";

        /* On force le navigateur à appliquer les styles */
        void planeImage.offsetWidth;

        /* Retour progressif au parking */
        planeImage.style.transition =
            "all 2.4s cubic-bezier(.2,.8,.25,1)";

        planeImage.style.transform =
            "translateY(-18px) translateX(0) scale(1)";

        await new Promise(resolve =>
            setTimeout(resolve, 2400)
        );

        planeImage.style.transition = "";

    });
}
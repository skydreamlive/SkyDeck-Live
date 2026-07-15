SkyDeck Live — Correctif avion v0.3.3

Fichier à remplacer :
- index.html

Le visuel d'origine utilisait le Boeing 737 de profil :
assets/images/boeing737_side.png

Si ce fichier n'existe pas ou ne charge pas, le code essaie automatiquement :
assets/images/boeing737.png

Vérifier que le dossier contient au moins un de ces fichiers :
SkyDeckLive/assets/images/boeing737_side.png
SkyDeckLive/assets/images/boeing737.png

Après remplacement :
1. Arrêter SkyDeck avec Ctrl+C.
2. Relancer avec npm start.
3. Actualiser la source navigateur dans OBS.

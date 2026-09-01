# Private Chat

Railway Logbook ki tarah plain HTML/CSS/JavaScript PWA. Android aur iPhone ke browser mein chalti hai aur Home Screen par install ho sakti hai.

## Included

- Do fixed roles: Person 1 and Person 2
- Messages left/right alignment
- Delivered and seen double ticks
- App minimize/background hote hi PIN lock
- Har person ke sirf latest 3 messages retained
- Offline-capable PWA shell
- Firebase Realtime Database adapter for two-phone sync

## Online sync setup

Firebase project mein Anonymous Authentication aur Realtime Database enable karein. Project ki web config `firebase-config.js` mein paste karein. Firebase config ke bina app local demo mode mein chalegi.

Recommended database rules ko sirf testing ke liye public na rakhein. Production mein authenticated users aur private room path ko restrict karein.

## GitHub Pages

Repository Settings → Pages → Deploy from branch → `main` / root.

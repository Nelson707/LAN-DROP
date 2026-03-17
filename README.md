# LAN Drop

Self-hosted, zero-install AirDrop for your local network. Run it once, send files between any devices on your WiFi — no cloud, no accounts, no cables.

## How it works

```
Device A ──┐                      ┌── Device B
           └──► Node server ◄─────┘
                (signaling only)
                     │
           WebRTC offer/answer exchange
                     │
Device A ◄──── direct P2P DataChannel ────► Device B
         (file bytes never touch the server)
```

## Quick start

### 1. Start the server

```bash
cd server
npm install
npm run dev
```

The server will print your LAN IP and a QR code.

### 2. Start the client

```bash
cd client
npm install
npm run dev
```

Vite will start on `http://localhost:5173` and expose it on your LAN.

### 3. Open on other devices

Scan the QR code printed by the server, or open `http://<your-ip>:5173` on any device on your WiFi.

## Sending files

- **Drag and drop** a file onto a device bubble
- **Click** a device bubble to open a file picker

## Stack

| Layer | Tech |
|---|---|
| Server | Node.js + Express + Socket.IO |
| Signaling | Socket.IO (relay only) |
| P2P transfer | WebRTC via `simple-peer` |
| Client | React + Vite |
| Device detection | `ua-parser-js` |
| QR code | `qrcode` |

## Project structure

```
lan-file-drop/
├── server/
│   ├── index.js          # Express + Socket.IO entry, signaling relay
│   ├── peers.js          # In-memory peer registry
│   └── package.json
└── client/
    ├── src/
    │   ├── App.jsx               # Root: socket init, peer state, layout
    │   ├── hooks/
    │   │   └── usePeer.js        # WebRTC + chunked file transfer logic
    │   └── components/
    │       ├── PeerBubble.jsx    # Device icon, drag target, progress ring
    │       └── TransferBar.jsx   # Transfer toast notifications
    ├── index.html
    ├── vite.config.js
    └── package.json
```

## Stretch ideas (Phase 5)

- [ ] Multi-file / folder drop (zip on the fly with JSZip)
- [ ] Clipboard sync (send text snippets)
- [ ] PIN-protect the room
- [ ] Transfer history log
- [ ] Animated send effect (file flying between bubbles)

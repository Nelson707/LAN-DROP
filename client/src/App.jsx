import React, { useEffect, useState, useCallback, useRef } from "react";
import { io } from "socket.io-client";
import UAParser from "ua-parser-js";
import { usePeer } from "./hooks/usePeer.js";
import PeerBubble from "./components/PeerBubble.jsx";
import TransferBar from "./components/TransferBar.jsx";

// Detect this device's type
function getDeviceType() {
  const parser = new UAParser();
  const result = parser.getResult();
  const type = result.device.type;
  if (type === "mobile") return "mobile";
  if (type === "tablet") return "tablet";
  return "laptop";
}

// Friendly default name
function getDefaultName() {
  const parser = new UAParser();
  const { os, device } = parser.getResult();

  // Mobile/tablet: use device model if available (e.g. "Samsung SM-G991B")
  if (device.model) return device.model;

  // Desktop: use OS name + version (e.g. "Windows 11", "macOS 14")
  if (os.name) {
    const version = os.version ? ` ${os.version.split(".")[0]}` : "";
    return `${os.name}${version}`;
  }

  return "Device";
}

let transferCounter = 0;

export default function App() {
  const [socket, setSocket] = useState(null);
  const [myId, setMyId] = useState(null);
  const [peers, setPeers] = useState([]);
  const [connected, setConnected] = useState(false);
  const [name, setName] = useState(getDefaultName);
  const [editingName, setEditingName] = useState(false);
  const [transfers, setTransfers] = useState([]);
  const [peerProgress, setPeerProgress] = useState({}); // peerId -> progress

  const updateTransfer = useCallback((id, patch) => {
    setTransfers((prev) => {
      const idx = prev.findIndex((t) => t.id === id);
      if (idx === -1) return [...prev, { id, ...patch }];
      const updated = [...prev];
      updated[idx] = { ...updated[idx], ...patch };
      return updated;
    });
    // Auto-remove after completion
    if (patch.progress >= 100) {
      setTimeout(() => {
        setTransfers((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    }
  }, []);

  const { sendFile } = usePeer({
    socket,
    onProgress: ({ peerId, direction, progress, fileName }) => {
      const id = `${peerId}-${fileName}`;
      updateTransfer(id, { direction, progress, fileName });
      if (direction === "send") {
        setPeerProgress((p) => ({ ...p, [peerId]: progress }));
        if (progress >= 100) {
          setTimeout(() => setPeerProgress((p) => { const n = {...p}; delete n[peerId]; return n; }), 2500);
        }
      }
    },
    onReceived: ({ fromId, fileName }) => {
      const id = `${fromId}-${fileName}`;
      updateTransfer(id, { progress: 100 });
    },
    onTransferStart: ({ fromId, fileName, fileSize }) => {
      const id = `${fromId}-${fileName}`;
      updateTransfer(id, { direction: "receive", progress: 0, fileName, fileSize });
    },
  });

  // Init socket
  useEffect(() => {
    const s = io({ transports: ["websocket"] });
    setSocket(s);

    s.on("connect", () => {
      setConnected(true);
      s.emit("register", { name, deviceType: getDeviceType() });
    });

    s.on("registered", ({ id, peers: peerList }) => {
      setMyId(id);
      setPeers(peerList.filter((p) => p.id !== id));
    });

    s.on("peer-joined", (peer) => {
      setPeers((prev) => {
        if (prev.find((p) => p.id === peer.id)) return prev;
        return [...prev, peer];
      });
    });

    s.on("peer-left", ({ id }) => {
      setPeers((prev) => prev.filter((p) => p.id !== id));
    });

    s.on("disconnect", () => setConnected(false));

    return () => s.disconnect();
  }, []); // eslint-disable-line

  // Re-register when name changes
  useEffect(() => {
    if (socket && connected) {
      socket.emit("register", { name, deviceType: getDeviceType() });
    }
  }, [name]); // eslint-disable-line

  const handleSend = useCallback(async (peerId, file) => {
    await sendFile(peerId, file);
  }, [sendFile]);

  const activeTransfers = transfers.filter((t) => t.progress < 100 || Date.now() - (t.completedAt || 0) < 3000);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "48px 24px",
      gap: 48,
    }}>
      {/* Header */}
      <header style={{ textAlign: "center", width: "100%", maxWidth: 560 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 6 }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: connected ? "var(--success)" : "var(--danger)",
            boxShadow: connected ? "0 0 8px var(--success)" : "none",
          }}/>
          <span style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--text3)", letterSpacing: "0.08em" }}>
            {connected ? "on your network" : "connecting…"}
          </span>
        </div>

        <h1 style={{
          fontSize: 32,
          fontWeight: 300,
          letterSpacing: "-0.02em",
          color: "var(--text)",
          marginBottom: 4,
        }}>
          LAN <span style={{ color: "var(--accent)", fontWeight: 500 }}>Drop</span>
        </h1>

        <p style={{ fontSize: 13, color: "var(--text3)", marginBottom: 20 }}>
          drop files to anyone on your network — no cloud, no accounts
        </p>

        {/* Name editor */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text3)" }}>you appear as · </span>
          {editingName ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
              style={{
                background: "var(--surface2)",
                border: "1px solid var(--accent)",
                borderRadius: 6,
                padding: "3px 10px",
                color: "var(--text)",
                fontSize: 13,
                fontFamily: "var(--sans)",
                outline: "none",
                width: 160,
              }}
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              style={{
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "3px 10px",
                color: "var(--accent2)",
                fontSize: 13,
                cursor: "pointer",
                fontFamily: "var(--sans)",
              }}
            >
              {name} ✎
            </button>
          )}
        </div>
      </header>

      {/* Peer grid */}
      <main style={{ width: "100%", maxWidth: 560 }}>
        {peers.length === 0 ? (
          <EmptyState />
        ) : (
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 32,
            justifyContent: "center",
          }}>
            {peers.map((peer) => (
              <PeerBubble
                key={peer.id}
                peer={peer}
                onSend={handleSend}
                progress={peerProgress[peer.id]}
              />
            ))}
          </div>
        )}
      </main>

      {/* Transfer toasts */}
      <TransferBar transfers={transfers} />
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{
      textAlign: "center",
      padding: "64px 24px",
      border: "1px dashed var(--border)",
      borderRadius: "var(--radius)",
      color: "var(--text3)",
    }}>
      <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.4 }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72m2.54-15.38c-3.72 4.35-8.94 5.66-16.88 5.85m19.5 1.9c-3.5-.93-6.63-.82-8.94 0-2.58.92-5.01 2.86-7.44 6.32"/>
        </svg>
      </div>
      <p style={{ fontSize: 14, marginBottom: 6 }}>No other devices found</p>
      <p style={{ fontSize: 12 }}>
        Open <span style={{ fontFamily: "var(--mono)", color: "var(--text2)" }}>this URL</span> on another device on your WiFi
      </p>
    </div>
  );
}

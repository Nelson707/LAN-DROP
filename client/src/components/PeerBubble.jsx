import React, { useState, useRef } from "react";

const DEVICE_ICONS = {
  mobile: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2"/>
      <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>
    </svg>
  ),
  tablet: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="2" width="18" height="20" rx="2"/>
      <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>
    </svg>
  ),
  desktop: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <path d="M8 21h8M12 17v4"/>
    </svg>
  ),
  laptop: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16v10H4z"/>
      <path d="M2 20h20"/>
    </svg>
  ),
};

export default function PeerBubble({ peer, onSend, progress }) {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState("idle"); // idle | sending | done | error
  const inputRef = useRef();

  const icon = DEVICE_ICONS[peer.deviceType] || DEVICE_ICONS.desktop;
  const isBusy = progress != null && progress < 100;

  const handleDrop = async (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    triggerSend(file);
  };

  const triggerSend = async (file) => {
    setStatus("sending");
    try {
      await onSend(peer.id, file);
      setStatus("done");
      setTimeout(() => setStatus("idle"), 2500);
    } catch (err) {
      console.error(err);
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  const handleClick = () => inputRef.current?.click();

  const statusColor = {
    idle: "var(--accent)",
    sending: "var(--warning)",
    done: "var(--success)",
    error: "var(--danger)",
  }[status];

  const statusLabel = {
    idle: null,
    sending: isBusy ? `${progress}%` : "connecting…",
    done: "sent!",
    error: "failed",
  }[status];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "10px",
        cursor: "pointer",
        userSelect: "none",
      }}
      onClick={handleClick}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        style={{ display: "none" }}
        onChange={(e) => { if (e.target.files[0]) triggerSend(e.target.files[0]); }}
      />

      {/* Bubble */}
      <div style={{
        position: "relative",
        width: 88,
        height: 88,
        borderRadius: "50%",
        background: dragging
          ? `rgba(79,156,249,0.18)`
          : status === "done"
          ? `rgba(62,207,142,0.12)`
          : status === "error"
          ? `rgba(248,113,113,0.12)`
          : "var(--surface2)",
        border: `2px solid ${dragging ? "var(--accent)" : statusColor}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.2s ease",
        boxShadow: dragging ? `0 0 24px rgba(79,156,249,0.25)` : "none",
        transform: dragging ? "scale(1.06)" : "scale(1)",
      }}>
        {/* Icon */}
        <div style={{
          width: 34,
          height: 34,
          color: dragging ? "var(--accent)" : statusColor,
          transition: "color 0.2s",
        }}>
          {icon}
        </div>

        {/* Progress ring */}
        {isBusy && (
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} viewBox="0 0 88 88">
            <circle cx="44" cy="44" r="42" fill="none" stroke="var(--border2)" strokeWidth="2"/>
            <circle
              cx="44" cy="44" r="42"
              fill="none"
              stroke="var(--warning)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={`${(progress / 100) * 2 * Math.PI * 42} 999`}
              transform="rotate(-90 44 44)"
              style={{ transition: "stroke-dasharray 0.15s" }}
            />
          </svg>
        )}
      </div>

      {/* Name */}
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{peer.name}</div>
        {statusLabel && (
          <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: statusColor, marginTop: 2 }}>
            {statusLabel}
          </div>
        )}
        {!statusLabel && (
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
            {peer.deviceType}
          </div>
        )}
      </div>
    </div>
  );
}

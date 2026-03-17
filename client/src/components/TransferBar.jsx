import React, { useEffect, useState } from "react";

export default function TransferBar({ transfers }) {
  if (!transfers.length) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 24,
      right: 24,
      display: "flex",
      flexDirection: "column",
      gap: 10,
      zIndex: 100,
      maxWidth: 320,
    }}>
      {transfers.map((t) => (
        <Toast key={t.id} transfer={t} />
      ))}
    </div>
  );
}

function Toast({ transfer }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Animate in
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const isReceiving = transfer.direction === "receive";
  const isDone = transfer.progress >= 100;
  const color = isDone ? "var(--success)" : isReceiving ? "var(--accent)" : "var(--warning)";

  const fmt = (bytes) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  return (
    <div style={{
      background: "var(--surface)",
      border: `1px solid var(--border)`,
      borderLeft: `3px solid ${color}`,
      borderRadius: "var(--radius-sm)",
      padding: "12px 14px",
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(12px)",
      transition: "all 0.25s ease",
      minWidth: 260,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text)" }}>
          {isReceiving ? "⬇ Receiving" : "⬆ Sending"}
        </span>
        <span style={{ fontSize: 11, fontFamily: "var(--mono)", color }}>
          {isDone ? "complete" : `${transfer.progress ?? 0}%`}
        </span>
      </div>

      <div style={{
        fontSize: 12,
        color: "var(--text2)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        marginBottom: 8,
      }}>
        {transfer.fileName}
        {transfer.fileSize ? ` · ${fmt(transfer.fileSize)}` : ""}
      </div>

      {/* Progress bar */}
      <div style={{ height: 3, background: "var(--border2)", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${transfer.progress ?? 0}%`,
          background: color,
          borderRadius: 2,
          transition: "width 0.15s ease",
        }}/>
      </div>
    </div>
  );
}

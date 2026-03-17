import { useEffect, useRef, useCallback } from "react";
import SimplePeer from "simple-peer";

const CHUNK_SIZE = 64 * 1024; // 64KB chunks

export function usePeer({ socket, onProgress, onReceived, onTransferStart }) {
  // Map of peerId -> SimplePeer instance
  const peersRef = useRef({});

  // Clean up a peer connection
  const destroyPeer = useCallback((peerId) => {
    if (peersRef.current[peerId]) {
      peersRef.current[peerId].destroy();
      delete peersRef.current[peerId];
    }
  }, []);

  // Create a peer and wire up signaling + data events
  const createPeer = useCallback(
    (peerId, initiator) => {
      destroyPeer(peerId);

      const peer = new SimplePeer({
        initiator,
        trickle: true,
        config: {
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        },
      });

      // Relay our signals through the socket server
      peer.on("signal", (data) => {
        if (data.type === "offer") {
          socket.emit("signal-offer", { targetId: peerId, offer: data });
        } else if (data.type === "answer") {
          socket.emit("signal-answer", { targetId: peerId, answer: data });
        } else {
          socket.emit("signal-ice", { targetId: peerId, candidate: data });
        }
      });

      // --- Receiving side ---
      // Buffer to accumulate incoming chunks
      let recvBuffer = [];
      let recvMeta = null;
      let recvBytes = 0;

      peer.on("data", (rawData) => {
        // First message is JSON metadata
        try {
          const msg = JSON.parse(rawData.toString());
          if (msg.type === "meta") {
            recvMeta = msg;
            recvBuffer = [];
            recvBytes = 0;
            onTransferStart?.({ fromId: peerId, ...msg });
            return;
          }
        } catch (_) {
          // Not JSON — it's a binary chunk
        }

        if (!recvMeta) return;

        // Accumulate binary chunk
        recvBuffer.push(rawData);
        recvBytes += rawData.byteLength;

        const progress = Math.round((recvBytes / recvMeta.fileSize) * 100);
        onProgress?.({ peerId, direction: "receive", progress, fileName: recvMeta.fileName });

        if (recvBytes >= recvMeta.fileSize) {
          // Reassemble and trigger download
          const blob = new Blob(recvBuffer, { type: recvMeta.fileType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = recvMeta.fileName;
          a.click();
          URL.revokeObjectURL(url);
          onReceived?.({ fromId: peerId, fileName: recvMeta.fileName, fileSize: recvMeta.fileSize });
          recvBuffer = [];
          recvMeta = null;
          recvBytes = 0;
        }
      });

      peer.on("error", (err) => console.error(`[peer ${peerId}] error:`, err));
      peer.on("close", () => destroyPeer(peerId));

      peersRef.current[peerId] = peer;
      return peer;
    },
    [socket, destroyPeer, onProgress, onReceived, onTransferStart]
  );

  // Wire up incoming signaling from the server
  useEffect(() => {
    if (!socket) return;

    const onOffer = ({ fromId, offer }) => {
      const peer = createPeer(fromId, false);
      peer.signal(offer);
    };

    const onAnswer = ({ fromId, answer }) => {
      peersRef.current[fromId]?.signal(answer);
    };

    const onIce = ({ fromId, candidate }) => {
      peersRef.current[fromId]?.signal(candidate);
    };

    socket.on("signal-offer", onOffer);
    socket.on("signal-answer", onAnswer);
    socket.on("signal-ice", onIce);

    return () => {
      socket.off("signal-offer", onOffer);
      socket.off("signal-answer", onAnswer);
      socket.off("signal-ice", onIce);
    };
  }, [socket, createPeer]);

  // Send a file to a peer
  const sendFile = useCallback(
    async (peerId, file, onProg) => {
      // Initiate connection if not already connected
      let peer = peersRef.current[peerId];
      if (!peer || peer.destroyed) {
        peer = createPeer(peerId, true);
        // Wait for connection to open
        await new Promise((resolve, reject) => {
          peer.once("connect", resolve);
          peer.once("error", reject);
          setTimeout(() => reject(new Error("Connection timeout")), 10000);
        });
      }

      // Send metadata first
      const meta = {
        type: "meta",
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || "application/octet-stream",
      };
      peer.send(JSON.stringify(meta));

      // Notify server so receiver can show incoming alert
      socket.emit("transfer-request", {
        targetId: peerId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      });

      // Read and send in chunks
      const buffer = await file.arrayBuffer();
      let offset = 0;
      let sent = 0;

      while (offset < buffer.byteLength) {
        const chunk = buffer.slice(offset, offset + CHUNK_SIZE);
        peer.send(chunk);
        offset += CHUNK_SIZE;
        sent += chunk.byteLength;
        const progress = Math.round((sent / file.size) * 100);
        onProg?.(progress);
        onProgress?.({ peerId, direction: "send", progress, fileName: file.name });
        // Yield to avoid blocking UI
        await new Promise((r) => setTimeout(r, 0));
      }
    },
    [socket, createPeer, onProgress]
  );

  // Clean up all peers on unmount
  useEffect(() => {
    return () => {
      Object.keys(peersRef.current).forEach(destroyPeer);
    };
  }, [destroyPeer]);

  return { sendFile };
}

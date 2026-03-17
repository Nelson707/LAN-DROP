// In-memory peer registry
export function createPeerRegistry() {
  const peers = new Map();

  return {
    add(id, { name, deviceType }) {
      const peer = { id, name, deviceType, joinedAt: Date.now() };
      peers.set(id, peer);
      return peer;
    },

    remove(id) {
      const peer = peers.get(id);
      peers.delete(id);
      return peer;
    },

    get(id) {
      return peers.get(id);
    },

    list() {
      return Array.from(peers.values());
    },
  };
}

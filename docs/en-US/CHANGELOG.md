# Changelog

All notable changes to @dreamer/webrtc are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [1.0.0] - 2026-02-20

### Added

- **Initial release**: First stable release of @dreamer/webrtc with a stable
  public API.

- **Signaling server** (`jsr:@dreamer/webrtc/server`):
  - Socket.IO-based signaling server for WebRTC connection setup and
    negotiation.
  - Configurable port, host, path, CORS, and Socket.IO options.
  - Room management: create/delete rooms, join/leave, list rooms and users.
  - STUN/TURN server configuration support (ICEServer list).
  - Forwarding of signaling messages between peers in the same room.
  - Server lifecycle: `listen()`, `close()`, and event handling.
  - Methods: `getRoom()`, `getUser()`, `getAllRooms()`, `getRoomUsers()` for
    room and user inspection.

- **WebRTC client** (`jsr:@dreamer/webrtc/client`):
  - `RTCClient` class for browser-based WebRTC connections.
  - Connection to signaling server with configurable URL and auto-connect.
  - Room operations: `joinRoom(roomId, userId?, multiPeer?)`, `leaveRoom()`.
  - Media: `getUserMedia()`, `getDisplayMedia()`, local/remote stream access via
    `getLocalStream()`, `getRemoteStream()`.
  - Data channel: `createDataChannel(label, options?)` for text and binary data.
  - Connection pool: configurable pool size for RTCPeerConnection instances.
  - Quality adaptation: automatic media quality adjustment (low/medium/high)
    based on network conditions.
  - Network quality: `getNetworkStats()` for bandwidth, packet loss, RTT, and
    quality level.
  - Auto-reconnect: configurable `reconnect`, `reconnectInterval`, and
    `maxReconnectAttempts`.
  - Events: `connection-state-change`, `ice-connection-state-change`, `stream`,
    `data-channel`, `error`; multi-room payloads include `userId` where
    applicable.
  - Stats: `getStats()`, `resetStats()` for messages sent/received, errors,
    reconnections.
  - Graceful behavior when `RTCPeerConnection` is unavailable (e.g. Node/Bun
    non-browser): `connect()` sets state to `failed` and does not open
    signaling.

- **Architecture modes**:
  - **Mesh**: Peer-to-peer connections for small rooms (default &lt; 10
    participants).
  - **SFU**: Server relay for large rooms (configurable threshold, default 10).
  - **Auto**: Automatically switch between Mesh and SFU based on room size.
  - Configurable mode and threshold on client and server.

- **WebRTCManager and service integration**:
  - `WebRTCManager` for managing multiple signaling server configurations.
  - `createWebRTCManager(options?)` factory for dependency injection.
  - Integration with `@dreamer/service` `ServiceContainer`: register and resolve
    WebRTCManager by name.
  - WebRTCManager API: `registerServer()`, `getServer()`, `hasServer()`,
    `removeServer()`, `getServerNames()`, `close()`, `getName()`,
    `setContainer()`, `getContainer()`, `fromContainer()`.

- **Internationalization (i18n)**:
  - Server-side messages (e.g. signaling server config not found) in **en-US**
    and **zh-CN** via `@dreamer/i18n`.
  - Locale detection from `LANGUAGE`, `LC_ALL`, `LANG` environment variables.
  - Exports from `./i18n.ts`: `$tr`, `setWebrtcLocale`, `detectLocale`.
  - Client module remains untranslated (browser-only).

- **Package exports**:
  - Main: `jsr:@dreamer/webrtc` (re-exports and shared types).
  - Client: `jsr:@dreamer/webrtc/client` (RTCClient and client types).
  - Server: `jsr:@dreamer/webrtc/server` (SignalingServer, WebRTCManager,
    createWebRTCManager, server types).

- **Dependencies**:
  - `@dreamer/socket-io` for signaling transport.
  - `@dreamer/runtime-adapter` for Deno/Bun compatibility.
  - `@dreamer/service` for optional service container integration.
  - `@dreamer/i18n` for server-side i18n.
  - `@dreamer/logger` for logging.

### Compatibility

- **Deno** 2.6+
- **Bun** 1.3.5+
- **Browsers**: Modern browsers with WebRTC support (Chrome, Firefox, Safari,
  Edge) for the client module; server runs on Deno or Bun.

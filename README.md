# @dreamer/webrtc

> 📖 English | [中文文档](./docs/zh-CN/README.md)

> A Socket.IO-based WebRTC real-time audio/video communication library with full
> signaling server and client implementation, fully compatible with Deno and
> Bun.

**Test report (EN)**: [docs/en-US/TEST_REPORT.md](./docs/en-US/TEST_REPORT.md)

[![JSR](https://jsr.io/badges/@dreamer/webrtc)](https://jsr.io/@dreamer/webrtc)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)
[![Tests](https://img.shields.io/badge/tests-194%20passed-brightgreen)](./docs/en-US/TEST_REPORT.md)

---

## Features

WebRTC real-time audio/video communication library with full signaling server
(based on Socket.IO) and client implementation. Supports one-to-one and
multi-participant room calls. Supports three architecture modes: Mesh, SFU, and
Auto (automatic switching). The optimal architecture is chosen automatically
based on room size (Mesh for small-scale peer-to-peer, SFU for large-scale
server relay). Provides connection pool management, quality adaptation, network
quality monitoring, auto-reconnect, and other advanced features. Fully
compatible with Deno, Bun runtimes, and modern browsers.

---

## Environment compatibility

| Environment | Version requirement | Status                                                            |
| ----------- | ------------------- | ----------------------------------------------------------------- |
| **Deno**    | 2.6+                | ✅ Fully supported                                                |
| **Bun**     | 1.3.5               | ✅ Fully supported                                                |
| **Server**  | -                   | ✅ Supported (Deno/Bun runtimes, signaling server)                |
| **Browser** | Modern browsers     | ✅ Supported (Chrome, Firefox, Safari, Edge, etc., WebRTC client) |

---

## Installation

### Deno

```bash
deno add jsr:@dreamer/webrtc
```

### Bun

```bash
bunx jsr add @dreamer/webrtc
```

### Client (browser)

Use the client package in the browser:

```typescript
import { RTCClient } from "jsr:@dreamer/webrtc/client";
```

---

## Features (detailed)

- **Core**:
  - Signaling server: Socket.IO-based signaling server for WebRTC connection
    setup and negotiation
  - WebRTC client: Browser-side WebRTC client for audio/video calls
  - Room management: Multi-participant rooms with automatic connection setup
  - STUN/TURN: STUN and TURN server configuration
  - Media stream management: Local and remote media stream management
  - Data channels: WebRTC data channels for text and binary data
- **Service container integration**:
  - Works with `@dreamer/service` dependency injection
  - WebRTCManager manages multiple signaling servers
  - `createWebRTCManager` factory
- **Advanced**:
  - Connection pool: RTCPeerConnection pool management for better resource use
  - Quality adaptation: Adjust media quality (low/medium/high) by network
  - Network quality monitoring: Bandwidth, packet loss, RTT, etc.
  - Auto-reconnect for more stable connections
  - Multi-participant modes: Mesh, SFU, and Auto
    - Mesh: Peer-to-peer for small rooms (&lt; 10 participants)
    - SFU: Server relay for large rooms (&gt; 10 participants)
    - Auto: Switch between Mesh and SFU by room size
  - Events: Connection state, media streams, and other events
- **Extras**:
  - Cross-runtime: Deno and Bun
  - TypeScript types
  - Configurable options for different use cases

---

## Use cases

- **Real-time audio/video**: One-to-one or multi-participant video calls
- **Online meetings**: Multi-participant video conferencing
- **Online education**: Real-time interactive teaching
- **Remote collaboration**: Remote work and collaboration
- **In-game voice**: Voice for multiplayer games
- **Live interaction**: Live streaming and interaction

---

## When to use @dreamer/webrtc

### When should you use @dreamer/webrtc?

#### Suitable scenarios

1. **Applications that need real-time audio/video**
   - Video conferencing
   - Online education platforms
   - Remote medical consultation
   - Online customer service
   - Social apps (video chat)

2. **Applications that need peer-to-peer communication**
   - One-to-one video calls
   - File transfer (via data channels)
   - Real-time collaboration
   - Screen sharing

3. **Multi-participant room scenarios**
   - Multi-participant video meetings (Mesh/SFU/Auto)
   - Online game voice
   - Virtual events / meetups
   - Team collaboration spaces
   - Large-scale online events (SFU)

4. **Projects that need cross-runtime compatibility**
   - Switching between Deno and Bun
   - Shared codebase for server and client
   - Flexible deployment

5. **Scenarios that need a full signaling server**
   - Custom signaling logic
   - Room management
   - User management
   - Statistics and monitoring

---

## Quick start

### Server: create signaling server

```typescript
import { SignalingServer } from "jsr:@dreamer/webrtc/server";

// Create signaling server
const server = new SignalingServer({
  port: 3000,
  host: "0.0.0.0",
  path: "/webrtc-signaling",
  stunServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
  // Optional: TURN servers
  // turnServers: [
  //   {
  //     urls: "turn:turn.example.com:3478",
  //     username: "user",
  //     credential: "pass",
  //   },
  // ],
});

// Start server
await server.listen();
console.log("WebRTC signaling server running at http://localhost:3000");
```

### Client: establish WebRTC connection

```typescript
import { RTCClient } from "jsr:@dreamer/webrtc/client";

// Create WebRTC client
const client = new RTCClient({
  signalingUrl: "http://localhost:3000",
  autoConnect: true,
});

// Connection state
client.on("connection-state-change", (state) => {
  console.log("Connection state:", state);
});

// ICE connection state
client.on("ice-connection-state-change", (state) => {
  console.log("ICE connection state:", state);
});

// Remote media stream
client.on("stream", (stream) => {
  console.log("Received remote media stream");
  const videoElement = document.getElementById(
    "remote-video",
  ) as HTMLVideoElement;
  if (videoElement) {
    videoElement.srcObject = stream;
  }
});

// Local media stream
client.on("stream", (stream) => {
  console.log("Received local media stream");
  const videoElement = document.getElementById(
    "local-video",
  ) as HTMLVideoElement;
  if (videoElement) {
    videoElement.srcObject = stream;
  }
});

// Network quality (quality adaptation)
setInterval(() => {
  const networkStats = client.getNetworkStats();
  console.log(
    `Network quality: ${networkStats.quality}, bandwidth: ${
      (networkStats.bandwidth / 1000).toFixed(0)
    } Kbps, packet loss: ${networkStats.packetLoss.toFixed(2)}%, RTT: ${
      networkStats.rtt.toFixed(0)
    }ms`,
  );
}, 5000);

// Join room
await client.joinRoom("room-123", "user-456");

// Leave room
// await client.leaveRoom();

// Disconnect
// await client.disconnect();
```

---

## Test report

The library is fully tested; all **163** test cases pass with 100% coverage. See
[docs/en-US/TEST_REPORT.md](./docs/en-US/TEST_REPORT.md) for the full report.

**Summary** (2026-01-27):

- **Total tests**: 163
- **Passed**: 163 ✅
- **Failed**: 0
- **Pass rate**: 100% ✅
- **Duration**: 2m37s
- **Coverage**: Public APIs, edge cases, error handling, architecture modes,
  hook lifecycle
- **Environments**: Deno 2.6+, Bun 1.3.5

**Test types**:

- ✅ Client/server unit and full tests (client, client-methods,
  client-comprehensive, server, server-methods, server-comprehensive)
- ✅ Integration tests (7)
- ✅ Edge cases and error handling (11)
- ✅ Hook execution (27: beforeAll/afterAll/beforeEach/afterEach)
- ✅ Browser tests (including architecture mode)
- ✅ Architecture mode tests (10: Mesh/SFU/Auto)

**Highlights**:

- ✅ Full coverage of features, edge cases, and error handling
- ✅ Integration tests cover end-to-end flows
- ✅ Browser tests verify behavior in real browsers
- ✅ Architecture mode tests verify Mesh, SFU, and Auto
- ✅ Hook tests verify test framework lifecycle

Full report: [docs/en-US/TEST_REPORT.md](./docs/en-US/TEST_REPORT.md)

---

## API reference

### SignalingServer

WebRTC signaling server class.

**Constructor**:

```typescript
new SignalingServer(options?: SignalingServerOptions)
```

**Options**:

- `port?: number`: Port (default: 3000)
- `host?: string`: Host (default: "0.0.0.0")
- `path?: string`: Socket.IO path (default: "/webrtc-signaling")
- `cors?: CorsOptions`: CORS
- `stunServers?: ICEServer[]`: STUN servers
- `turnServers?: ICEServer[]`: TURN servers

**Methods**:

- `listen(): Promise<void>`: Start server
- `close(): Promise<void>`: Close server
- `getRoom(roomId: string): RoomInfo | undefined`: Get room info
- `getUser(userId: string): UserInfo | undefined`: Get user info
- `getAllRooms(): RoomInfo[]`: Get all rooms
- `getRoomUsers(roomId: string): string[]`: Get users in a room

### RTCClient

WebRTC client class.

**Constructor**:

```typescript
new RTCClient(options: RTCClientOptions)
```

**Options**:

- `signalingUrl: string`: Signaling server URL (required)
- `roomId?: string`: Room ID (optional)
- `userId?: string`: User ID (optional)
- `rtcConfiguration?: RTCConfiguration`: WebRTC config
- `mediaConstraints?: MediaStreamConstraints`: Media constraints
- `autoConnect?: boolean`: Auto-connect (default: true)
- `reconnect?: boolean`: Auto-reconnect (default: true)
- `reconnectInterval?: number`: Reconnect interval (default: 1000 ms)
- `maxReconnectAttempts?: number`: Max reconnect attempts (default: 5)
- `connectionPoolSize?: number`: Connection pool size (default: 5)
- `enableQualityAdaptation?: boolean`: Quality adaptation (default: true)

**Methods**:

- `connect(): void`: Connect to signaling server. In environments without
  `RTCPeerConnection` (e.g. Node/Bun non-browser), state is set to `failed`
  immediately; if signaling does not connect within the timeout, state is set to
  `failed` and connection is closed.
- `disconnect(): void`: Disconnect
- `joinRoom(roomId: string, userId?: string, multiPeer?: boolean): Promise<void>`:
  Join room (supports multi-participant)
- `leaveRoom(): void`: Leave room
- `getUserMedia(constraints?: MediaStreamConstraints): Promise<MediaStream>`:
  Get user media
- `getDisplayMedia(constraints?: MediaStreamConstraints): Promise<MediaStream>`:
  Get display/screen share
- `createDataChannel(label: string, options?: RTCDataChannelInit): RTCDataChannel | null`:
  Create data channel
- `getLocalStream(): MediaStream | undefined`: Get local stream
- `getRemoteStream(): MediaStream | undefined`: Get remote stream (P2P)
- `getConnectionState(): ConnectionState`: Get connection state
- `getICEConnectionState(): ICEConnectionState`: Get ICE state
- `getStats(): { messagesSent, messagesReceived, errors, reconnections }`:
  Connection stats
- `resetStats(): void`: Reset stats
- `getNetworkStats(): { bandwidth, packetLoss, rtt, quality }`: Network stats
- `on(event: RTCEvent, callback: EventCallback): void`: Subscribe to event
- `off(event: RTCEvent, callback?: EventCallback): void`: Unsubscribe

**Events**:

- `connection-state-change`: Connection state
- `ice-connection-state-change`: ICE connection state
- `stream`: Media stream (local or remote). In multi-participant mode, payload
  is `{ userId, stream }`
- `data-channel`: Data channel. In multi-participant mode, payload is
  `{ userId, channel }`
- `error`: Error

**Multi-participant room**:

```typescript
// Multi-participant (Mesh)
await client.joinRoom("room-123", "user-456", true);

// Listen for streams in multi-participant room
client.on("stream", ({ userId, stream }) => {
  console.log(`Received stream from user ${userId}`);
  // Bind stream to video element
});
```

---

## Usage examples

### Example 1: One-to-one video call

```typescript
import { RTCClient } from "jsr:@dreamer/webrtc/client";

const client = new RTCClient({
  signalingUrl: "http://localhost:3000",
  autoConnect: true,
});

const localStream = await client.getUserMedia({ video: true, audio: true });

await client.joinRoom("room-123", "user-456");

client.on("stream", (stream) => {
  const videoElement = document.getElementById(
    "remote-video",
  ) as HTMLVideoElement;
  if (videoElement) {
    videoElement.srcObject = stream;
  }
});
```

### Example 2: Multi-participant room

```typescript
import { RTCClient } from "jsr:@dreamer/webrtc/client";

const client = new RTCClient({
  signalingUrl: "http://localhost:3000",
  autoConnect: true,
});

await client.joinRoom("room-123", "user-456", true);

client.on("stream", ({ userId, stream }) => {
  console.log(`Received stream from user ${userId}`);
  const videoElement = document.getElementById(
    `video-${userId}`,
  ) as HTMLVideoElement;
  if (videoElement) {
    videoElement.srcObject = stream;
  }
});
```

### Example 3: Data channel

```typescript
import { RTCClient } from "jsr:@dreamer/webrtc/client";

const client = new RTCClient({
  signalingUrl: "http://localhost:3000",
  autoConnect: true,
});

await client.joinRoom("room-123", "user-456");

const dataChannel = client.createDataChannel("chat");

dataChannel.onopen = () => {
  dataChannel.send("Hello, World!");

  const buffer = new ArrayBuffer(8);
  dataChannel.send(buffer);
};

dataChannel.onmessage = (event) => {
  console.log("Received:", event.data);
};
```

---

## Advanced configuration

### Connection pool

```typescript
const client = new RTCClient({
  signalingUrl: "http://localhost:3000",
  connectionPoolSize: 10,
});
```

### Quality adaptation

```typescript
const client = new RTCClient({
  signalingUrl: "http://localhost:3000",
  enableQualityAdaptation: true,
});
```

### Auto-reconnect

```typescript
const client = new RTCClient({
  signalingUrl: "http://localhost:3000",
  reconnect: true,
  reconnectInterval: 2000,
  maxReconnectAttempts: 10,
});
```

### STUN/TURN

```typescript
const client = new RTCClient({
  signalingUrl: "http://localhost:3000",
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    {
      urls: "turn:turn.example.com:3478",
      username: "user",
      credential: "pass",
    },
  ],
});
```

---

## Architecture comparison and capacity

### SFU vs Mesh

| Metric                     | Mesh              | SFU                        |
| -------------------------- | ----------------- | -------------------------- |
| **Max participants/room**  | 10–20             | 100–1,000+                 |
| **Connections per client** | (N-1)             | 1                          |
| **Client downlink**        | (N-1) × stream    | Controllable (subscribe)   |
| **Server connections**     | N (signaling)     | N (media)                  |
| **Server bandwidth**       | Low (signaling)   | High (relay)               |
| **Server CPU**             | Low               | Medium                     |
| **Latency**                | Lowest (P2P)      | Low (one hop)              |
| **Flexibility**            | Low (all streams) | High (selective subscribe) |

### Single SFU server capacity

| Server spec (CPU, RAM, network)      | Concurrent users | Rooms (50/room) | Notes        |
| ------------------------------------ | ---------------- | --------------- | ------------ |
| **Low** (4 cores, 8 GB, 1 Gbps)      | 500–800          | 10–16           | Small/medium |
| **Medium** (8 cores, 16 GB, 10 Gbps) | 1,000–2,000      | 20–40           | Medium/large |
| **High** (16 cores, 32 GB, 10 Gbps)  | 2,000–5,000      | 40–100          | Large        |
| **Cluster** (multiple servers)       | 10,000+          | 200+            | Very large   |

### Per-room capacity

| Participants | Connections per client | Server connections | Server load | Feasibility            |
| ------------ | ---------------------- | ------------------ | ----------- | ---------------------- |
| 10           | 1                      | 10                 | Low         | ✅ Yes                 |
| 50           | 1                      | 50                 | Medium      | ✅ Yes                 |
| 100          | 1                      | 100                | Medium      | ✅ Yes                 |
| 500          | 1                      | 500                | High        | ✅ Yes (strong server) |
| 1,000        | 1                      | 1,000              | Very high   | ⚠️ Cluster or strong   |
| 5,000        | 1                      | 5,000              | Very high   | ⚠️ Cluster             |

---

## ServiceContainer integration

### createWebRTCManager factory

```typescript
import { ServiceContainer } from "@dreamer/service";
import { createWebRTCManager, WebRTCManager } from "@dreamer/webrtc/server";

const container = new ServiceContainer();

container.registerSingleton(
  "webrtc:main",
  () => createWebRTCManager({ name: "main" }),
);

const manager = container.get<WebRTCManager>("webrtc:main");

manager.registerServer("production", {
  port: 3000,
  stunServers: [{ urls: "stun:stun.l.google.com:19302" }],
});

const server = manager.getServer("production");
await server.listen();
```

### WebRTCManager API

| Method                            | Description            |
| --------------------------------- | ---------------------- |
| `getName()`                       | Get manager name       |
| `setContainer(container)`         | Set service container  |
| `getContainer()`                  | Get service container  |
| `fromContainer(container, name?)` | Get from container     |
| `registerServer(name, config)`    | Register server config |
| `getServer(name)`                 | Get or create server   |
| `hasServer(name)`                 | Check if server exists |
| `removeServer(name)`              | Remove server          |
| `getServerNames()`                | List server names      |
| `close()`                         | Close all servers      |

---

## Performance

- **Connection pool**: Manages RTCPeerConnection pool to reduce create/destroy
  cost
- **Quality adaptation**: Adjusts media quality by network to save bandwidth
- **Batched ICE candidates**: Fewer signaling messages
- **Network monitoring**: Monitor quality and adjust strategy
- **Cleanup**: Cleans unused connections and resources to avoid leaks

---

## Notes

- **Browser**: Client code must run in a browser. In Node/Bun without
  `RTCPeerConnection`, `connect()` sets state to `failed` immediately and does
  not open signaling; `joinRoom` and similar will fail without WebRTC support.
- **HTTPS**: In production, WebRTC typically requires HTTPS (except localhost).
- **STUN/TURN**: Use STUN for NAT; use TURN in complex networks.
- **Media permissions**: Browser will request camera and microphone.

---

## Contributing

Issues and Pull Requests are welcome.

---

## License

Apache License 2.0 — see [LICENSE](./LICENSE)

---

<div align="center">**Made with ❤️ by Dreamer Team**</div>

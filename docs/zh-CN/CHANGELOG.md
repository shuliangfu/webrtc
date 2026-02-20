# 变更日志

@dreamer/webrtc 的所有重要变更均记录于此。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [1.0.0] - 2026-02-20

### 新增

- **初始发布**：@dreamer/webrtc 首个稳定版本，提供稳定的公开 API。

- **信令服务端**（`jsr:@dreamer/webrtc/server`）：
  - 基于 Socket.IO 的信令服务器，用于 WebRTC 连接建立与协商。
  - 可配置端口、主机、路径、CORS 及 Socket.IO 选项。
  - 房间管理：创建/删除房间、加入/离开、获取房间列表与用户列表。
  - STUN/TURN 服务器配置（ICEServer 列表）。
  - 同一房间内对等端之间的信令消息转发。
  - 服务端生命周期：`listen()`、`close()` 及事件处理。
  - 方法：`getRoom()`、`getUser()`、`getAllRooms()`、`getRoomUsers()` 用于
    房间与用户查询。

- **WebRTC 客户端**（`jsr:@dreamer/webrtc/client`）：
  - 用于浏览器端 WebRTC 连接的 `RTCClient` 类。
  - 连接信令服务器，支持可配置 URL 与自动连接。
  - 房间操作：`joinRoom(roomId, userId?, multiPeer?)`、`leaveRoom()`。
  - 媒体：`getUserMedia()`、`getDisplayMedia()`，通过 `getLocalStream()`、
    `getRemoteStream()` 获取本地/远端流。
  - 数据通道：`createDataChannel(label, options?)` 支持文本与二进制数据。
  - 连接池：可配置的 RTCPeerConnection 实例池大小。
  - 质量自适应：根据网络状况自动调整媒体质量（低/中/高）。
  - 网络质量：`getNetworkStats()` 提供带宽、丢包率、RTT 及质量等级。
  - 自动重连：可配置 `reconnect`、`reconnectInterval`、`maxReconnectAttempts`。
  - 事件：`connection-state-change`、`ice-connection-state-change`、`stream`、
    `data-channel`、`error`；多人房间下 payload 在适用处包含 `userId`。
  - 统计：`getStats()`、`resetStats()` 用于收发消息数、错误数、重连次数。
  - 在无 `RTCPeerConnection` 环境（如 Node/Bun 非浏览器）下优雅降级：
    `connect()` 将状态设为 `failed` 且不建立信令连接。

- **架构模式**：
  - **Mesh**：小规模房间（默认 &lt; 10 人）的点对点连接。
  - **SFU**：大规模房间（可配置阈值，默认 10）的服务器转发。
  - **Auto**：根据房间人数在 Mesh 与 SFU 之间自动切换。
  - 客户端与服务端均支持模式与阈值配置。

- **WebRTCManager 与服务集成**：
  - `WebRTCManager` 用于管理多套信令服务器配置。
  - `createWebRTCManager(options?)` 工厂函数，便于依赖注入。
  - 与 `@dreamer/service` 的 `ServiceContainer` 集成：按名称注册与解析
    WebRTCManager。
  - WebRTCManager API：`registerServer()`、`getServer()`、`hasServer()`、
    `removeServer()`、`getServerNames()`、`close()`、`getName()`、
    `setContainer()`、`getContainer()`、`fromContainer()`。

- **国际化（i18n）**：
  - 服务端文案（如未找到信令服务器配置）提供 **en-US** 与 **zh-CN**，基于
    `@dreamer/i18n`。
  - 通过环境变量 `LANGUAGE`、`LC_ALL`、`LANG` 检测语言。
  - 从 `./i18n.ts` 导出：`$tr`、`setWebrtcLocale`、`detectLocale`。
  - 客户端模块暂不翻译（仅浏览器端）。

- **包导出**：
  - 主入口：`jsr:@dreamer/webrtc`（再导出与共享类型）。
  - 客户端：`jsr:@dreamer/webrtc/client`（RTCClient 及客户端类型）。
  - 服务端：`jsr:@dreamer/webrtc/server`（SignalingServer、WebRTCManager、
    createWebRTCManager、服务端类型）。

- **依赖**：
  - `@dreamer/socket-io` 用于信令传输。
  - `@dreamer/runtime-adapter` 用于 Deno/Bun 兼容。
  - `@dreamer/service` 用于可选的服务容器集成。
  - `@dreamer/i18n` 用于服务端 i18n。
  - `@dreamer/logger` 用于日志。

### 兼容性

- **Deno** 2.6+
- **Bun** 1.3.5+
- **浏览器**：支持 WebRTC 的现代浏览器（Chrome、Firefox、Safari、Edge）用于
  客户端模块；服务端运行于 Deno 或 Bun。

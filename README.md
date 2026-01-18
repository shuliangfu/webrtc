# @dreamer/webrtc

> 一个基于 Socket.IO 的 WebRTC 实时音视频通信库，提供完整的信令服务器和客户端实现，全面兼容 Deno 和 Bun

[![JSR](https://jsr.io/badges/@dreamer/webrtc)](https://jsr.io/@dreamer/webrtc)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-137%20passed-brightgreen)](./TEST_REPORT.md)

---

## 🎯 功能

WebRTC 实时音视频通信库，提供完整的信令服务器（基于 Socket.IO）和客户端实现，支持一对一和多人房间通话。支持 Mesh、SFU 和自动切换（Auto）三种架构模式，可根据房间人数自动选择最优架构（小规模使用 Mesh 点对点连接，大规模使用 SFU 服务器转发）。提供连接池管理、质量自适应、网络质量监控、自动重连等高级功能，全面兼容 Deno、Bun 运行时和现代浏览器环境。

---

## 🌍 环境兼容性

| 环境 | 版本要求 | 状态 |
|------|---------|------|
| **Deno** | 2.6+ | ✅ 完全支持 |
| **Bun** | 1.3.5 | ✅ 完全支持 |
| **服务端** | - | ✅ 支持（兼容 Deno 和 Bun 运行时，提供信令服务器） |
| **浏览器** | 现代浏览器 | ✅ 支持（Chrome、Firefox、Safari、Edge 等，提供 WebRTC 客户端） |

---

## 📦 安装

### Deno

```bash
deno add jsr:@dreamer/webrtc
```

### Bun

```bash
bunx jsr add @dreamer/webrtc
```

### 客户端（浏览器环境）

在浏览器中使用客户端包：

```typescript
import { RTCClient } from "jsr:@dreamer/webrtc/client";
```

---

## ✨ 特性

- **核心功能**：
  - 信令服务器：基于 Socket.IO 的信令服务器，用于 WebRTC 连接建立和协商
  - WebRTC 客户端：浏览器端的 WebRTC 客户端，支持音视频通话
  - 房间管理：支持多人房间，自动处理连接建立
  - STUN/TURN 支持：支持 STUN 和 TURN 服务器配置
  - 媒体流管理：自动管理本地和远程媒体流
  - 数据通道：支持 WebRTC 数据通道，用于传输文本和二进制数据
- **高级特性**：
  - 连接池管理：自动管理 RTCPeerConnection 连接池，优化资源使用
  - 质量自适应：根据网络状况自动调整媒体流质量（低/中/高）
  - 网络质量监控：实时监控带宽、丢包率、RTT 等网络指标
  - 自动重连：支持自动重连机制，提高连接稳定性
  - 多人房间模式：支持 Mesh、SFU 和自动切换（Auto）三种架构模式
    - Mesh 模式：小规模房间（< 10 人）的点对点连接
    - SFU 模式：大规模房间（> 10 人）的服务器转发架构
    - Auto 模式：根据房间人数自动在 Mesh 和 SFU 之间切换
  - 事件系统：完整的事件监听机制，支持连接状态、媒体流等事件
- **扩展支持**：
  - 跨运行时兼容：全面兼容 Deno 和 Bun 运行时
  - 类型安全：完整的 TypeScript 类型定义
  - 灵活配置：支持丰富的配置选项，满足不同场景需求

---

## 🎯 使用场景

- **实时音视频通话**：一对一或多人视频通话
- **在线会议**：多人视频会议系统
- **在线教育**：实时互动教学
- **远程协作**：远程办公和协作工具
- **游戏语音**：多人游戏的语音通信
- **直播互动**：实时直播和互动

---

## 💡 适用场景

### 什么时候应该使用 @dreamer/webrtc？

#### ✅ 适合使用的场景

1. **需要实时音视频通信的应用**
   - 视频会议系统
   - 在线教育平台
   - 远程医疗咨询
   - 在线客服系统
   - 社交应用（视频聊天）

2. **需要点对点通信的应用**
   - 一对一视频通话
   - 文件传输（通过数据通道）
   - 实时协作工具
   - 屏幕共享应用

3. **需要多人房间功能的场景**
   - 多人视频会议（Mesh/SFU/Auto 架构）
   - 在线游戏语音
   - 虚拟活动/聚会
   - 团队协作空间
   - 大规模在线活动（使用 SFU 架构）

4. **需要跨运行时兼容的项目**
   - 需要在 Deno 和 Bun 之间切换的项目
   - 需要服务端和客户端统一代码库的项目
   - 需要灵活的部署选项的项目

5. **需要完整信令服务器的场景**
   - 需要自定义信令逻辑
   - 需要房间管理功能
   - 需要用户管理功能
   - 需要统计和监控功能

---

## 🚀 快速开始

### 服务端：创建信令服务器

```typescript
import { SignalingServer } from "jsr:@dreamer/webrtc/server";

// 创建信令服务器
const server = new SignalingServer({
  port: 3000,
  host: "0.0.0.0",
  path: "/webrtc-signaling",
  stunServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
  // 可选：TURN 服务器配置
  // turnServers: [
  //   {
  //     urls: "turn:turn.example.com:3478",
  //     username: "user",
  //     credential: "pass",
  //   },
  // ],
});

// 启动服务器
await server.listen();
console.log("WebRTC 信令服务器运行在 http://localhost:3000");
```

### 客户端：建立 WebRTC 连接

```typescript
import { RTCClient } from "jsr:@dreamer/webrtc/client";

// 创建 WebRTC 客户端
const client = new RTCClient({
  signalingUrl: "http://localhost:3000",
  autoConnect: true,
});

// 监听连接状态变化
client.on("connection-state-change", (state) => {
  console.log("连接状态:", state);
});

// 监听 ICE 连接状态变化
client.on("ice-connection-state-change", (state) => {
  console.log("ICE 连接状态:", state);
});

// 监听远程媒体流
client.on("stream", (stream) => {
  console.log("收到远程媒体流");
  // 将流绑定到 video 元素
  const videoElement = document.getElementById("remote-video") as HTMLVideoElement;
  if (videoElement) {
    videoElement.srcObject = stream;
  }
});

// 监听本地媒体流
client.on("stream", (stream) => {
  console.log("收到本地媒体流");
  // 将流绑定到 video 元素
  const videoElement = document.getElementById("local-video") as HTMLVideoElement;
  if (videoElement) {
    videoElement.srcObject = stream;
  }
});

// 监听网络质量变化（质量自适应功能）
setInterval(() => {
  const networkStats = client.getNetworkStats();
  console.log(
    `网络质量: ${networkStats.quality}, 带宽: ${(networkStats.bandwidth / 1000).toFixed(0)} Kbps, 丢包率: ${networkStats.packetLoss.toFixed(2)}%, RTT: ${networkStats.rtt.toFixed(0)}ms`,
  );
}, 5000);

// 加入房间
await client.joinRoom("room-123", "user-456");

// 离开房间
// await client.leaveRoom();

// 断开连接
// await client.disconnect();
```

---

## 📊 测试报告

本库经过全面测试，所有 137 个测试用例均已通过，测试覆盖率达到 100%。详细测试报告请查看 [TEST_REPORT.md](./TEST_REPORT.md)。

**测试统计**（2026-01-18 10:13:24）：
- **总测试数**: 137
- **通过**: 137 ✅
- **失败**: 0
- **通过率**: 100% ✅
- **测试执行时间**: ~2分34秒
- **测试覆盖**: 所有公共 API、边界情况、错误处理、架构模式功能
- **测试环境**: Deno 2.6+, Bun 1.3.5

**测试类型**：
- ✅ 单元测试（74 个）
- ✅ 集成测试（7 个）
- ✅ 边界情况和错误处理测试（11 个）
- ✅ 浏览器测试（24 个，含架构模式测试）
- ✅ 架构模式测试（10 个，Mesh/SFU/Auto）

**测试亮点**：
- ✅ 所有功能、边界情况、错误处理都有完整的测试覆盖
- ✅ 集成测试验证了端到端的完整流程
- ✅ 浏览器测试验证了在真实浏览器环境中的功能
- ✅ 架构模式测试验证了 Mesh、SFU 和自动切换功能的正确性

查看完整测试报告：[TEST_REPORT.md](./TEST_REPORT.md)

---

## 📚 API 文档

### SignalingServer

WebRTC 信令服务器类。

**构造函数**：
```typescript
new SignalingServer(options?: SignalingServerOptions)
```

**选项**：
- `port?: number`: 端口号（默认：3000）
- `host?: string`: 主机地址（默认："0.0.0.0"）
- `path?: string`: Socket.IO 路径（默认："/webrtc-signaling"）
- `cors?: CorsOptions`: CORS 配置
- `stunServers?: ICEServer[]`: STUN 服务器列表
- `turnServers?: ICEServer[]`: TURN 服务器列表

**方法**：
- `listen(): Promise<void>`: 启动服务器
- `close(): Promise<void>`: 关闭服务器
- `getRoom(roomId: string): RoomInfo | undefined`: 获取房间信息
- `getUser(userId: string): UserInfo | undefined`: 获取用户信息
- `getAllRooms(): RoomInfo[]`: 获取所有房间
- `getRoomUsers(roomId: string): string[]`: 获取房间内的用户列表

### RTCClient

WebRTC 客户端类。

**构造函数**：
```typescript
new RTCClient(options: RTCClientOptions)
```

**选项**：
- `signalingUrl: string`: 信令服务器 URL（必需）
- `roomId?: string`: 房间 ID（可选）
- `userId?: string`: 用户 ID（可选）
- `rtcConfiguration?: RTCConfiguration`: WebRTC 配置选项
- `mediaConstraints?: MediaStreamConstraints`: 媒体流约束
- `autoConnect?: boolean`: 是否自动连接（默认：true）
- `reconnect?: boolean`: 是否自动重连（默认：true）
- `reconnectInterval?: number`: 重连间隔（默认：1000ms）
- `maxReconnectAttempts?: number`: 最大重连次数（默认：5）
- `connectionPoolSize?: number`: 连接池大小（默认：5）
- `enableQualityAdaptation?: boolean`: 是否启用质量自适应（默认：true）

**方法**：
- `connect(): void`: 连接到信令服务器
- `disconnect(): void`: 断开连接
- `joinRoom(roomId: string, userId?: string, multiPeer?: boolean): Promise<void>`: 加入房间（支持多人房间模式）
- `leaveRoom(): void`: 离开房间
- `getUserMedia(constraints?: MediaStreamConstraints): Promise<MediaStream>`: 获取用户媒体
- `getDisplayMedia(constraints?: MediaStreamConstraints): Promise<MediaStream>`: 获取屏幕共享
- `createDataChannel(label: string, options?: RTCDataChannelInit): RTCDataChannel | null`: 创建数据通道
- `getLocalStream(): MediaStream | undefined`: 获取本地媒体流
- `getRemoteStream(): MediaStream | undefined`: 获取远程媒体流（点对点模式）
- `getConnectionState(): ConnectionState`: 获取连接状态
- `getICEConnectionState(): ICEConnectionState`: 获取 ICE 连接状态
- `getStats(): { messagesSent, messagesReceived, errors, reconnections }`: 获取连接统计信息
- `resetStats(): void`: 重置统计信息
- `getNetworkStats(): { bandwidth, packetLoss, rtt, quality }`: 获取网络质量统计信息
- `on(event: RTCEvent, callback: EventCallback): void`: 监听事件
- `off(event: RTCEvent, callback?: EventCallback): void`: 移除事件监听器

**事件**：
- `connection-state-change`: 连接状态变化
- `ice-connection-state-change`: ICE 连接状态变化
- `stream`: 收到媒体流（本地或远程）。多人房间模式下，事件数据为 `{ userId, stream }`
- `data-channel`: 收到数据通道。多人房间模式下，事件数据为 `{ userId, channel }`
- `error`: 发生错误

**多人房间模式**：
```typescript
// 启用多人房间模式（Mesh 架构）
await client.joinRoom("room-123", "user-456", true);

// 监听多人房间的流
client.on("stream", ({ userId, stream }) => {
  console.log(`收到用户 ${userId} 的流`);
  // 将流绑定到对应的 video 元素
});
```

---

## 🎨 使用示例

### 示例 1：一对一视频通话

```typescript
import { RTCClient } from "jsr:@dreamer/webrtc/client";

const client = new RTCClient({
  signalingUrl: "http://localhost:3000",
  autoConnect: true,
});

// 获取本地媒体流
const localStream = await client.getUserMedia({ video: true, audio: true });

// 加入房间
await client.joinRoom("room-123", "user-456");

// 监听远程媒体流
client.on("stream", (stream) => {
  const videoElement = document.getElementById("remote-video") as HTMLVideoElement;
  if (videoElement) {
    videoElement.srcObject = stream;
  }
});
```

### 示例 2：多人房间通话

```typescript
import { RTCClient } from "jsr:@dreamer/webrtc/client";

const client = new RTCClient({
  signalingUrl: "http://localhost:3000",
  autoConnect: true,
});

// 启用多人房间模式
await client.joinRoom("room-123", "user-456", true);

// 监听多人房间的流
client.on("stream", ({ userId, stream }) => {
  console.log(`收到用户 ${userId} 的流`);
  // 将流绑定到对应的 video 元素
  const videoElement = document.getElementById(`video-${userId}`) as HTMLVideoElement;
  if (videoElement) {
    videoElement.srcObject = stream;
  }
});
```

### 示例 3：数据通道通信

```typescript
import { RTCClient } from "jsr:@dreamer/webrtc/client";

const client = new RTCClient({
  signalingUrl: "http://localhost:3000",
  autoConnect: true,
});

await client.joinRoom("room-123", "user-456");

// 创建数据通道
const dataChannel = client.createDataChannel("chat");

dataChannel.onopen = () => {
  // 发送文本消息
  dataChannel.send("Hello, World!");

  // 发送二进制数据
  const buffer = new ArrayBuffer(8);
  dataChannel.send(buffer);
};

dataChannel.onmessage = (event) => {
  console.log("收到消息:", event.data);
};
```

---

## 🔧 高级配置

### 连接池配置

```typescript
const client = new RTCClient({
  signalingUrl: "http://localhost:3000",
  connectionPoolSize: 10, // 连接池大小
});
```

### 质量自适应配置

```typescript
const client = new RTCClient({
  signalingUrl: "http://localhost:3000",
  enableQualityAdaptation: true, // 启用质量自适应
});
```

### 自动重连配置

```typescript
const client = new RTCClient({
  signalingUrl: "http://localhost:3000",
  reconnect: true, // 启用自动重连
  reconnectInterval: 2000, // 重连间隔（毫秒）
  maxReconnectAttempts: 10, // 最大重连次数
});
```

### STUN/TURN 服务器配置

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

## 📈 架构对比与容量说明

### SFU vs Mesh 对比

| 指标 | Mesh 架构 | SFU 架构 |
|------|----------|----------|
| **单个房间最大人数** | 10-20 人 | 100-1,000+ 人 |
| **客户端连接数** | (N-1) 个 | 1 个 |
| **客户端带宽（下行）** | (N-1) × 流大小 | 可控制（只订阅需要的流） |
| **服务器连接数** | N 个（信令） | N 个（媒体） |
| **服务器带宽** | 低（只处理信令） | 高（需要转发媒体流） |
| **服务器 CPU** | 低 | 中 |
| **延迟** | 最低（P2P 直连） | 低（增加一跳） |
| **灵活性** | 低（必须接收所有流） | 高（可以选择性订阅） |

### 单 SFU 服务器容量

| 服务器配置 | 并发用户数 | 房间数（每房间 50 人） | 说明 |
|-----------|-----------|---------------------|------|
| **低配**（4 核 CPU，8 GB 内存，1 Gbps） | 500-800 人 | 10-16 个房间 | 适合中小规模 |
| **中配**（8 核 CPU，16 GB 内存，10 Gbps） | 1,000-2,000 人 | 20-40 个房间 | 适合中大规模 |
| **高配**（16 核 CPU，32 GB 内存，10 Gbps） | 2,000-5,000 人 | 40-100 个房间 | 适合大规模 |
| **集群**（多台服务器） | 10,000+ 人 | 200+ 个房间 | 适合超大规模 |

### 单个房间容量

| 房间人数 | 客户端连接数 | 服务器连接数 | 服务器负载 | 可行性 |
|---------|------------|------------|-----------|--------|
| 10 人 | 每个客户端 1 个 | 10 个 | 低 | ✅ 完全可行 |
| 50 人 | 每个客户端 1 个 | 50 个 | 中 | ✅ 完全可行 |
| 100 人 | 每个客户端 1 个 | 100 个 | 中 | ✅ 完全可行 |
| 500 人 | 每个客户端 1 个 | 500 个 | 高 | ✅ 可行（需要高配服务器） |
| 1,000 人 | 每个客户端 1 个 | 1,000 个 | 很高 | ⚠️ 需要集群或高配服务器 |
| 5,000 人 | 每个客户端 1 个 | 5,000 个 | 极高 | ⚠️ 需要集群部署 |

---

## 🚀 性能优化

- **连接池管理**：自动管理 RTCPeerConnection 连接池，减少创建和销毁开销
- **质量自适应**：根据网络状况自动调整媒体流质量，优化带宽使用
- **批量 ICE 候选**：批量发送 ICE 候选，减少信令消息数量
- **网络质量监控**：实时监控网络质量，及时调整策略
- **资源清理**：自动清理不再使用的连接和资源，防止内存泄漏

---

## 📝 注意事项

- **浏览器环境**：客户端代码需要在浏览器环境中运行
- **HTTPS 要求**：在生产环境中，WebRTC 需要 HTTPS 连接（localhost 除外）
- **STUN/TURN 服务器**：对于 NAT 穿透，建议配置 STUN 服务器；对于复杂网络环境，需要配置 TURN 服务器
- **媒体权限**：浏览器会请求摄像头和麦克风权限

- **浏览器环境**：客户端代码需要在浏览器环境中运行
- **HTTPS 要求**：在生产环境中，WebRTC 需要 HTTPS 连接（localhost 除外）
- **STUN/TURN 服务器**：对于 NAT 穿透，建议配置 STUN 服务器；对于复杂网络环境，需要配置 TURN 服务器
- **媒体权限**：浏览器会请求摄像头和麦克风权限

---

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

## 📄 许可证

MIT License - 详见 [LICENSE.md](./LICENSE.md)

---

<div align="center">

**Made with ❤️ by Dreamer Team**

</div>

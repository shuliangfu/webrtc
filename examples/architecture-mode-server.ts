/**
 * @module @dreamer/webrtc/examples/architecture-mode-server
 *
 * @fileoverview WebRTC 架构模式示例服务器
 * 演示不同架构模式（Mesh、SFU、Auto）的信令服务器配置
 */

import { SignalingServer } from "../src/server/server.ts";

// 创建信令服务器
const server = new SignalingServer({
  port: 3000,
  host: "0.0.0.0",
  path: "/webrtc-signaling",
  stunServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
  // 如果需要支持 SFU 模式，可以配置 TURN 服务器
  // turnServers: [
  //   {
  //     urls: "turn:your-turn-server.com:3478",
  //     username: "your-username",
  //     credential: "your-password",
  //   },
  // ],
});

// 注意：SignalingServer 当前未暴露 connection / disconnect / room-joined / room-left 等事件 API，
// 若需监听可在后续版本通过 options 或扩展类实现。此处仅启动服务器。
// 启动服务器
await server.listen();
console.log("WebRTC 架构模式示例服务器运行在 http://localhost:3000");
console.log("");
console.log("支持的架构模式：");
console.log("  - Mesh（点对点）：所有客户端直接连接");
console.log("  - SFU（选择性转发）：通过服务器转发（需要配置 SFU 服务器）");
console.log("  - Auto（自动切换）：根据房间人数自动选择最优架构");
console.log("");

// 优雅关闭
Deno.addSignalListener("SIGINT", async () => {
  console.log("\n正在关闭服务器...");
  await server.close();
  Deno.exit(0);
});

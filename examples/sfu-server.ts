/**
 * @module @dreamer/webrtc/examples/sfu-server
 *
 * @fileoverview WebRTC SFU 模式示例服务器
 * 演示 SFU 模式的信令服务器配置
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
  // SFU 模式通常需要 TURN 服务器来支持 NAT 穿透
  // turnServers: [
  //   {
  //     urls: "turn:your-turn-server.com:3478",
  //     username: "your-username",
  //     credential: "your-password",
  //   },
  // ],
});

// 注意：SignalingServer 当前未暴露 connection / disconnect / room-joined / room-left / message 等事件 API，
// 若需监听或处理 SFU 信令可在后续版本通过 options 或扩展类实现。此处仅启动服务器。
// 启动服务器
await server.listen();
console.log("WebRTC SFU 模式示例服务器运行在 http://localhost:3000");
console.log("");
console.log("SFU 模式说明：");
console.log("  - 客户端连接到 SFU 服务器进行媒体转发");
console.log("  - 适合大规模房间（> 10 人）");
console.log("  - 需要配置实际的 SFU 媒体服务器");
console.log("  - 本示例仅提供信令服务器，SFU 媒体服务器需要单独部署");
console.log("");

// 优雅关闭
Deno.addSignalListener("SIGINT", async () => {
  console.log("\n正在关闭服务器...");
  await server.close();
  Deno.exit(0);
});

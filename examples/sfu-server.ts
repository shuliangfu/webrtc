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

// 监听连接事件
server.on("connection", (socket) => {
  console.log(`客户端连接: ${socket.id}`);
});

// 监听断开事件
server.on("disconnect", (socket) => {
  console.log(`客户端断开: ${socket.id}`);
});

// 监听房间事件
server.on("room-joined", (data) => {
  console.log(`用户 ${data.userId} 加入房间 ${data.roomId}`);
});

server.on("room-left", (data) => {
  console.log(`用户 ${data.userId} 离开房间 ${data.roomId}`);
});

// 监听 SFU 相关消息
server.on("message", (socket, message) => {
  // 处理 SFU 特定的信令消息
  if (message.type === "sfu-connect") {
    console.log(`客户端 ${socket.id} 请求连接 SFU 服务器`);
    // 这里可以返回 SFU 服务器地址给客户端
    // socket.emit("sfu-connect-response", { sfuUrl: "ws://sfu-server:8080" });
  }
});

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

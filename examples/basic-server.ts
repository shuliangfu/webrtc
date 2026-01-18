/**
 * WebRTC 信令服务器基础示例
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
});

// 启动服务器
await server.listen();
console.log("WebRTC 信令服务器运行在 http://localhost:3000");

// 优雅关闭
Deno.addSignalListener("SIGINT", async () => {
  console.log("\n正在关闭服务器...");
  await server.close();
  Deno.exit(0);
});

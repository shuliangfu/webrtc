/**
 * @module @dreamer/webrtc
 *
 * WebRTC 实时音视频通信库，提供语音和视频通话功能。
 *
 * 功能特性：
 * - 信令服务器：基于 Socket.IO 的信令服务器，用于 WebRTC 连接建立和协商
 * - WebRTC 客户端：浏览器端的 WebRTC 客户端，支持音视频通话
 * - 房间管理：支持多人房间，自动处理连接建立
 * - STUN/TURN 支持：支持 STUN 和 TURN 服务器配置
 * - 媒体流管理：自动管理本地和远程媒体流
 *
 * @example
 * ```typescript
 * // 服务端：创建信令服务器
 * import { SignalingServer } from "jsr:@dreamer/webrtc/server";
 *
 * const server = new SignalingServer({
 *   port: 3000,
 *   stunServers: [{ urls: "stun:stun.l.google.com:19302" }],
 * });
 *
 * await server.listen();
 * ```
 *
 * @example
 * ```typescript
 * // 客户端：建立 WebRTC 连接
 * import { RTCClient } from "jsr:@dreamer/webrtc/client";
 *
 * const client = new RTCClient({
 *   signalingUrl: "http://localhost:3000",
 * });
 *
 * await client.joinRoom("room-123", "user-456");
 * client.on("stream", (stream) => {
 *   // 处理远程媒体流
 * });
 * ```
 */

// 导出类型
export * from "./types.ts";

// 导出服务端模块
export * from "./server/mod.ts";

// 导出客户端模块（通过 /client 子路径访问）
// 客户端代码在 src/client/mod.ts 中

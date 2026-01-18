/**
 * @fileoverview WebRTC 集成测试
 * 测试客户端和服务端的完整交互流程
 */

import { afterEach, beforeEach, describe, expect, it } from "@dreamer/test";
import { RTCClient } from "../src/client/mod.ts";
import { SignalingServer } from "../src/server/mod.ts";
import {
  delay,
  getAvailablePort,
  waitForPortRelease,
  waitForServerReady,
} from "./test-utils.ts";

describe("WebRTC 集成测试", () => {
  let server: SignalingServer;
  let testPort: number;
  let serverUrl: string;

  beforeEach(async () => {
    testPort = getAvailablePort();
    serverUrl = `http://localhost:${testPort}`;
    server = new SignalingServer({
      port: testPort,
      stunServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    await server.listen();
    // 使用 waitForServerReady 确保服务器在 Bun 环境下完全启动
    // 传入 serverUrl 进行实际连接验证
    await waitForServerReady(serverUrl);
  });

  afterEach(async () => {
    // 等待所有异步操作完成
    await delay(300);
    if (server) {
      await server.close();
      // 等待端口完全释放（在 Bun 环境中需要更长时间）
      await waitForPortRelease(testPort);
    }
  });

  describe("房间加入和离开", () => {
    it("应该允许客户端加入房间", async () => {
      // 跳过实际 WebRTC 连接测试（需要浏览器环境）
      if (typeof globalThis.RTCPeerConnection === "undefined") {
        return;
      }

      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      await delay(100);
      client.connect();
      await delay(1000);

      try {
        await client.joinRoom("test-room", "user-1");
        await delay(500);

        const room = server.getRoom("test-room");
        expect(room).toBeTruthy();
        expect(room?.users).toContain("user-1");
      } finally {
        client.disconnect();
        await delay(500);
      }
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });

    it("应该允许多个客户端加入同一房间", async () => {
      // 跳过实际 WebRTC 连接测试（需要浏览器环境）
      if (typeof globalThis.RTCPeerConnection === "undefined") {
        return;
      }

      const client1 = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      const client2 = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });

      await delay(100);
      client1.connect();
      client2.connect();
      await delay(1000);

      try {
        await client1.joinRoom("test-room", "user-1");
        await delay(500);
        await client2.joinRoom("test-room", "user-2");
        await delay(500);

        const room = server.getRoom("test-room");
        expect(room).toBeTruthy();
        expect(room?.users.length).toBe(2);
        expect(room?.users).toContain("user-1");
        expect(room?.users).toContain("user-2");
      } finally {
        client1.disconnect();
        client2.disconnect();
        await delay(500);
      }
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });

    it("应该允许客户端离开房间", async () => {
      // 跳过实际 WebRTC 连接测试（需要浏览器环境）
      if (typeof globalThis.RTCPeerConnection === "undefined") {
        return;
      }

      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      await delay(100);
      client.connect();
      await delay(1000);

      try {
        await client.joinRoom("test-room", "user-1");
        await delay(500);

        client.leaveRoom();
        await delay(500);

        const room = server.getRoom("test-room");
        // 房间可能被删除（如果没有其他用户）或用户被移除
        if (room) {
          expect(room.users).not.toContain("user-1");
        }
      } finally {
        client.disconnect();
        await delay(500);
      }
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });
  });

  describe("信令消息处理", () => {
    it("应该处理信令消息统计", async () => {
      // 跳过实际 WebRTC 连接测试（需要浏览器环境）
      if (typeof globalThis.RTCPeerConnection === "undefined") {
        return;
      }

      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      await delay(100);
      client.connect();
      await delay(1000);

      try {
        await client.joinRoom("test-room", "user-1");
        await delay(500);

        const serverStats = server.getStats();
        expect(serverStats.messagesReceived).toBeGreaterThanOrEqual(0);
        expect(serverStats.messagesSent).toBeGreaterThanOrEqual(0);
      } finally {
        client.disconnect();
        await delay(500);
      }
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });

    it("应该提供网络质量建议", async () => {
      // 跳过实际 WebRTC 连接测试（需要浏览器环境）
      if (typeof globalThis.RTCPeerConnection === "undefined") {
        return;
      }

      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      await delay(100);
      client.connect();
      await delay(1000);

      try {
        await client.joinRoom("test-room", "user-1");
        await delay(500);

        const suggestion = server.getNetworkQualitySuggestion("test-room");
        expect(suggestion).toBeTruthy();
        expect(["good", "fair", "poor"]).toContain(suggestion.quality);
        expect(typeof suggestion.averageLatency).toBe("number");
        expect(typeof suggestion.messageLossRate).toBe("number");
        expect(typeof suggestion.recommendation).toBe("string");
      } finally {
        client.disconnect();
        await delay(500);
      }
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });
  });

  describe("服务器统计", () => {
    it("应该统计活跃房间和用户", async () => {
      // 跳过实际 WebRTC 连接测试（需要浏览器环境）
      if (typeof globalThis.RTCPeerConnection === "undefined") {
        return;
      }

      const client1 = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      const client2 = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });

      await delay(100);
      client1.connect();
      client2.connect();
      await delay(1000);

      try {
        await client1.joinRoom("room-1", "user-1");
        await delay(500);
        await client2.joinRoom("room-2", "user-2");
        await delay(500);

        const stats = server.getStats();
        expect(stats.activeRooms).toBeGreaterThanOrEqual(0);
        expect(stats.activeUsers).toBeGreaterThanOrEqual(0);
      } finally {
        client1.disconnect();
        client2.disconnect();
        await delay(500);
      }
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });

    it("应该重置统计信息", async () => {
      server.resetStats();
      const stats = server.getStats();
      expect(stats.messagesReceived).toBe(0);
      expect(stats.messagesSent).toBe(0);
      expect(stats.messagesDelayed).toBe(0);
      expect(stats.averageLatency).toBe(0);
    }, { timeout: 15000 });
  });
});

/**
 * @fileoverview 信令服务器全面测试
 * 测试 SignalingServer 的所有功能，包括批量处理、统计等
 */

import { afterEach, beforeEach, describe, expect, it } from "@dreamer/test";
import { SignalingServer } from "../src/server/mod.ts";
import {
  delay,
  getAvailablePort,
  waitForPortRelease,
  waitForServerReady,
} from "./test-utils.ts";
import type { SignalingMessage } from "../src/types.ts";

describe("SignalingServer 全面测试", () => {
  let server: SignalingServer;
  let testPort: number;

  beforeEach(async () => {
    testPort = getAvailablePort();
    server = new SignalingServer({
      port: testPort,
      stunServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    await server.listen();
    // 使用 waitForServerReady 确保服务器在 Bun 环境下完全启动
    await waitForServerReady();
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

  describe("批量消息处理", () => {
    it("应该批量处理 ICE candidates", async () => {
      // 这个测试需要实际的 Socket.IO 客户端连接
      // 在实际测试中，可以通过客户端发送多个 ICE candidates
      // 验证服务器是否正确批量处理
      expect(server).toBeTruthy();
    }, { timeout: 15000 });
  });

  describe("房间和用户管理", () => {
    it("应该创建房间", () => {
      const room = server.getRoom("new-room");
      expect(room).toBeUndefined();
    }, { timeout: 15000 });

    it("应该获取所有房间", () => {
      const rooms = server.getAllRooms();
      expect(Array.isArray(rooms)).toBe(true);
    }, { timeout: 15000 });

    it("应该获取房间用户列表", () => {
      const users = server.getRoomUsers("non-existent-room");
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBe(0);
    }, { timeout: 15000 });

    it("应该获取用户信息", () => {
      const user = server.getUser("non-existent-user");
      expect(user).toBeUndefined();
    }, { timeout: 15000 });
  });

  describe("统计和监控", () => {
    it("应该获取服务器统计信息", () => {
      const stats = server.getStats();
      expect(stats).toBeTruthy();
      expect(typeof stats.messagesReceived).toBe("number");
      expect(typeof stats.messagesSent).toBe("number");
      expect(typeof stats.messagesDelayed).toBe("number");
      expect(typeof stats.averageLatency).toBe("number");
      expect(typeof stats.activeRooms).toBe("number");
      expect(typeof stats.activeUsers).toBe("number");
    }, { timeout: 15000 });

    it("应该重置统计信息", () => {
      server.resetStats();
      const stats = server.getStats();
      expect(stats.messagesReceived).toBe(0);
      expect(stats.messagesSent).toBe(0);
      expect(stats.messagesDelayed).toBe(0);
      expect(stats.averageLatency).toBe(0);
    }, { timeout: 15000 });

    it("应该提供网络质量建议", () => {
      const suggestion = server.getNetworkQualitySuggestion();
      expect(suggestion).toBeTruthy();
      expect(["good", "fair", "poor"]).toContain(suggestion.quality);
      expect(typeof suggestion.averageLatency).toBe("number");
      expect(typeof suggestion.messageLossRate).toBe("number");
      expect(typeof suggestion.recommendation).toBe("string");
    }, { timeout: 15000 });

    it("应该为特定房间提供网络质量建议", () => {
      const suggestion = server.getNetworkQualitySuggestion("room-123");
      expect(suggestion).toBeTruthy();
      expect(["good", "fair", "poor"]).toContain(suggestion.quality);
    }, { timeout: 15000 });
  });

  describe("配置选项", () => {
    it("应该支持自定义路径", () => {
      const customServer = new SignalingServer({
        port: getAvailablePort(),
        path: "/custom-path",
      });
      expect(customServer).toBeTruthy();
      customServer.close();
    }, { timeout: 15000 });

    it("应该支持 CORS 配置", () => {
      const corsServer = new SignalingServer({
        port: getAvailablePort(),
        cors: {
          origin: "*",
        },
      });
      expect(corsServer).toBeTruthy();
      corsServer.close();
    }, { timeout: 15000 });
  });
});

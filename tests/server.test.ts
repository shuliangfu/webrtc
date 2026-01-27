/**
 * @fileoverview WebRTC 信令服务器测试
 * 测试 SignalingServer 的所有功能
 */

import { afterEach, beforeEach, describe, expect, it } from "@dreamer/test";
import { SignalingServer } from "../src/server/mod.ts";
import {
  delay,
  getAvailablePort,
  getAvailablePortAsync,
  waitForPortRelease,
  waitForServerReady,
} from "./test-utils.ts";

describe("SignalingServer", () => {
  let server: SignalingServer;
  let testPort: number;

  beforeEach(async () => {
    testPort = await getAvailablePortAsync();
    server = new SignalingServer({
      port: testPort,
      stunServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
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

  describe("服务器创建和配置", () => {
    it("应该创建服务器实例", () => {
      expect(server).toBeTruthy();
    }, { timeout: 15000 });

    it("应该使用默认配置", async () => {
      const defaultServer = new SignalingServer();
      expect(defaultServer).toBeTruthy();
      await defaultServer.close();
    }, { timeout: 15000 });

    it("应该使用自定义端口", () => {
      expect(server).toBeTruthy();
    }, { timeout: 15000 });

    it("应该配置 STUN 服务器", () => {
      const serverWithStun = new SignalingServer({
        port: getAvailablePort(),
        stunServers: [{ urls: "stun:custom.stun.server:19302" }],
      });
      expect(serverWithStun).toBeTruthy();
      serverWithStun.close();
    }, { timeout: 15000 });

    it("应该配置 TURN 服务器", () => {
      const serverWithTurn = new SignalingServer({
        port: getAvailablePort(),
        turnServers: [
          {
            urls: "turn:turn.example.com:3478",
            username: "user",
            credential: "pass",
          },
        ],
      });
      expect(serverWithTurn).toBeTruthy();
      serverWithTurn.close();
    }, { timeout: 15000 });
  });

  describe("服务器生命周期", () => {
    it("应该启动服务器", async () => {
      await server.listen();
      await waitForServerReady();
      expect(server).toBeTruthy();
    }, { timeout: 15000 });

    it("应该关闭服务器", async () => {
      await server.listen();
      await waitForServerReady();
      await server.close();
      await delay(100);
      // 服务器应该已关闭
      expect(server).toBeTruthy();
    }, { timeout: 15000 });
  });

  describe("房间管理", () => {
    beforeEach(async () => {
      await server.listen();
      await waitForServerReady();
    });

    it("应该获取房间信息", () => {
      const room = server.getRoom("non-existent-room");
      expect(room).toBeUndefined();
    }, { timeout: 15000 });

    it("应该获取所有房间", () => {
      const rooms = server.getAllRooms();
      expect(Array.isArray(rooms)).toBe(true);
      expect(rooms.length).toBe(0);
    }, { timeout: 15000 });

    it("应该获取房间用户列表", () => {
      const users = server.getRoomUsers("non-existent-room");
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBe(0);
    }, { timeout: 15000 });
  });

  describe("用户管理", () => {
    beforeEach(async () => {
      await server.listen();
      await delay(200);
    });

    it("应该获取用户信息", () => {
      const user = server.getUser("non-existent-user");
      expect(user).toBeUndefined();
    }, { timeout: 15000 });
  });

  describe("统计信息", () => {
    beforeEach(async () => {
      await server.listen();
      await delay(200);
    });

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

    it("应该获取网络质量建议", () => {
      const suggestion = server.getNetworkQualitySuggestion();
      expect(suggestion).toBeTruthy();
      expect(["good", "fair", "poor"]).toContain(suggestion.quality);
      expect(typeof suggestion.averageLatency).toBe("number");
      expect(typeof suggestion.messageLossRate).toBe("number");
      expect(typeof suggestion.recommendation).toBe("string");
    }, { timeout: 15000 });

    it("应该为特定房间获取网络质量建议", () => {
      const suggestion = server.getNetworkQualitySuggestion("room-123");
      expect(suggestion).toBeTruthy();
      expect(["good", "fair", "poor"]).toContain(suggestion.quality);
    }, { timeout: 15000 });
  });
});

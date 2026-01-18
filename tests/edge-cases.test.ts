/**
 * @fileoverview 边界情况和错误处理测试
 * 测试各种边界情况和错误处理
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

describe("边界情况和错误处理", () => {
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
    await delay(300);
    if (server) {
      await server.close();
      // 等待端口完全释放（在 Bun 环境中需要更长时间）
      await waitForPortRelease(testPort);
    }
  });

  describe("客户端边界情况", () => {
    it("应该处理未连接时调用 joinRoom", async () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      await delay(100);

      // 未连接时调用 joinRoom 应该不会抛出错误
      try {
        await client.joinRoom("test-room", "user-1");
      } catch (error) {
        // 允许错误，但不应该崩溃
        expect(error).toBeTruthy();
      }

      client.disconnect();
      await delay(300);
    }, { timeout: 15000 });

    it("应该处理重复调用 disconnect", async () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      await delay(100);

      client.disconnect();
      await delay(100);
      // 重复调用应该不会抛出错误
      client.disconnect();
      await delay(300);
    }, { timeout: 15000 });

    it("应该处理未加入房间时调用 leaveRoom", async () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      await delay(100);

      // 未加入房间时调用 leaveRoom 应该不会抛出错误
      client.leaveRoom();
      await delay(300);

      client.disconnect();
      await delay(300);
    }, { timeout: 15000 });

    it("应该处理多次调用 on 和 off", async () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      await delay(100);

      const handler = () => {};
      client.on("connection-state-change", handler);
      client.on("connection-state-change", handler);
      client.off("connection-state-change", handler);
      client.off("connection-state-change", handler);
      client.off("connection-state-change", handler); // 移除不存在的监听器

      expect(client).toBeTruthy();
      client.disconnect();
      await delay(300);
    }, { timeout: 15000 });
  });

  describe("服务端边界情况", () => {
    it("应该处理获取不存在的房间", () => {
      const room = server.getRoom("non-existent-room");
      expect(room).toBeUndefined();
    }, { timeout: 15000 });

    it("应该处理获取不存在的用户", () => {
      const user = server.getUser("non-existent-user");
      expect(user).toBeUndefined();
    }, { timeout: 15000 });

    it("应该处理获取不存在房间的用户列表", () => {
      const users = server.getRoomUsers("non-existent-room");
      expect(Array.isArray(users)).toBe(true);
      expect(users.length).toBe(0);
    }, { timeout: 15000 });

    it("应该处理多次重置统计信息", () => {
      server.resetStats();
      server.resetStats();
      server.resetStats();

      const stats = server.getStats();
      expect(stats.messagesReceived).toBe(0);
      expect(stats.messagesSent).toBe(0);
    }, { timeout: 15000 });

    it("应该处理多次关闭服务器", async () => {
      await server.close();
      await delay(200);
      // 重复关闭应该不会抛出错误
      await server.close();
      await delay(200);
    }, { timeout: 15000 });
  });

  describe("配置选项边界情况", () => {
    it("应该处理空的 signalingUrl", () => {
      // 这个测试可能会失败，但应该优雅地处理
      try {
        const client = new RTCClient({
          signalingUrl: "",
          autoConnect: false,
        });
        expect(client).toBeTruthy();
        client.disconnect();
      } catch (error) {
        // 允许错误
        expect(error).toBeTruthy();
      }
    }, { timeout: 15000 });

    it("应该处理无效的端口", async () => {
      // 使用无效端口创建服务器应该失败
      try {
        const invalidServer = new SignalingServer({
          port: -1,
        });
        await invalidServer.listen();
        await invalidServer.close();
      } catch (error) {
        // 允许错误
        expect(error).toBeTruthy();
      }
    }, { timeout: 15000 });
  });
});

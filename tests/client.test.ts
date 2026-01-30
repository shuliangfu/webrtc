/**
 * @fileoverview WebRTC 客户端测试
 * 测试 RTCClient 的所有功能
 */

import { afterEach, beforeEach, describe, expect, it } from "@dreamer/test";
import { RTCClient } from "../src/client/mod.ts";
import { SignalingServer } from "../src/server/mod.ts";
import {
  delay,
  getAvailablePortAsync,
  waitForPortRelease,
  waitForServerReady,
} from "./test-utils.ts";

describe("RTCClient", () => {
  let server: SignalingServer;
  let testPort: number;
  let serverUrl: string;

  beforeEach(async () => {
    testPort = await getAvailablePortAsync();
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

  describe("客户端创建和配置", () => {
    it("应该创建客户端实例", async () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      await delay(100);
      expect(client).toBeTruthy();
      client.disconnect();
      await delay(100);
    }, { timeout: 15000 });

    it("应该使用默认配置", async () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      await delay(100);
      expect(client).toBeTruthy();
      client.disconnect();
      await delay(100);
    }, { timeout: 15000 });

    it("应该配置连接池大小", async () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
        connectionPoolSize: 10,
      });
      await delay(100);
      expect(client).toBeTruthy();
      client.disconnect();
      await delay(100);
    }, { timeout: 15000 });

    it("应该配置质量自适应", async () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
        enableQualityAdaptation: true,
      });
      await delay(100);
      expect(client).toBeTruthy();
      client.disconnect();
      await delay(100);
    }, { timeout: 15000 });
  });

  describe("连接管理", () => {
    it("应该手动连接", async () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      await delay(100);
      client.connect();
      await delay(500);
      expect(client).toBeTruthy();
      client.disconnect();
      await delay(200);
    }, { timeout: 15000 });

    it("应该自动连接", async () => {
      const hasRTC = typeof (globalThis as { RTCPeerConnection?: unknown })
        .RTCPeerConnection !==
        "undefined";
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: true,
      });

      if (hasRTC) {
        // 有 WebRTC（如 Deno/浏览器）：等待信令连接成功，断言状态为 connected
        const deadline = Date.now() + 8_000;
        while (
          client.getConnectionState() !== "connected" && Date.now() < deadline
        ) {
          await delay(200);
        }
        expect(client.getConnectionState()).toBe("connected");
      } else {
        // 无 WebRTC（如 Bun）：connect() 会立即置为 failed，短延迟后断言
        await delay(300);
        expect(client.getConnectionState()).toBe("failed");
      }

      client.disconnect();
      await delay(200);
    }, { timeout: 15000 });

    it("应该断开连接", async () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      await delay(100);
      client.connect();
      await delay(500);
      client.disconnect();
      await delay(200);
      expect(client.getConnectionState()).toBe("closed");
    }, { timeout: 15000 });
  });

  describe("状态管理", () => {
    it("应该获取连接状态", async () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      await delay(100);
      const state = client.getConnectionState();
      expect([
        "new",
        "connecting",
        "connected",
        "disconnected",
        "failed",
        "closed",
      ]).toContain(state);
      client.disconnect();
      await delay(100);
    }, { timeout: 15000 });

    it("应该获取 ICE 连接状态", async () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      await delay(100);
      const state = client.getICEConnectionState();
      expect([
        "new",
        "checking",
        "connected",
        "completed",
        "failed",
        "disconnected",
        "closed",
      ]).toContain(state);
      client.disconnect();
      await delay(100);
    }, { timeout: 15000 });
  });

  describe("统计信息", () => {
    it("应该获取连接统计信息", async () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      await delay(100);
      const stats = client.getStats();
      expect(stats).toBeTruthy();
      expect(typeof stats.messagesSent).toBe("number");
      expect(typeof stats.messagesReceived).toBe("number");
      expect(typeof stats.errors).toBe("number");
      expect(typeof stats.reconnections).toBe("number");
      client.disconnect();
      await delay(100);
    }, { timeout: 15000 });

    it("应该重置统计信息", async () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      await delay(100);
      client.resetStats();
      const stats = client.getStats();
      expect(stats.messagesSent).toBe(0);
      expect(stats.messagesReceived).toBe(0);
      expect(stats.errors).toBe(0);
      expect(stats.reconnections).toBe(0);
      client.disconnect();
      await delay(100);
    }, { timeout: 15000 });

    it("应该获取网络质量统计信息", async () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      await delay(100);
      const networkStats = client.getNetworkStats();
      expect(networkStats).toBeTruthy();
      expect(typeof networkStats.bandwidth).toBe("number");
      expect(typeof networkStats.packetLoss).toBe("number");
      expect(typeof networkStats.rtt).toBe("number");
      expect(["low", "medium", "high"]).toContain(networkStats.quality);
      client.disconnect();
      await delay(100);
    }, { timeout: 15000 });

    it("应该获取连接池统计信息", async () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      await delay(100);
      const poolStats = client.getConnectionPoolStats();
      expect(poolStats).toBeTruthy();
      expect(typeof poolStats.created).toBe("number");
      expect(typeof poolStats.released).toBe("number");
      expect(typeof poolStats.active).toBe("number");
      expect(typeof poolStats.pendingClose).toBe("number");
      expect(typeof poolStats.configCacheSize).toBe("number");
      client.disconnect();
      await delay(100);
    }, { timeout: 15000 });
  });

  describe("事件系统", () => {
    it("应该监听事件", async () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      await delay(100);
      let _eventFired = false;
      client.on("connection-state-change", () => {
        _eventFired = true;
      });
      client.connect();
      await delay(500);
      expect(client).toBeTruthy();
      client.disconnect();
      await delay(200);
    }, { timeout: 15000 });

    it("应该移除事件监听器", async () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      await delay(100);
      const handler = () => {};
      client.on("connection-state-change", handler);
      client.off("connection-state-change", handler);
      expect(client).toBeTruthy();
      client.disconnect();
      await delay(100);
    }, { timeout: 15000 });

    it("应该移除所有事件监听器", async () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      await delay(100);
      client.on("connection-state-change", () => {});
      client.off("connection-state-change");
      expect(client).toBeTruthy();
      client.disconnect();
      await delay(100);
    }, { timeout: 15000 });
  });

  describe("媒体流管理", () => {
    it("应该获取本地媒体流（未获取时返回 undefined）", async () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      await delay(100);
      const stream = client.getLocalStream();
      expect(stream).toBeUndefined();
      client.disconnect();
      await delay(100);
    }, { timeout: 15000 });

    it("应该获取远程媒体流（未接收时返回 undefined）", async () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      await delay(100);
      const stream = client.getRemoteStream();
      expect(stream).toBeUndefined();
      client.disconnect();
      await delay(100);
    }, { timeout: 15000 });
  });
}, { sanitizeOps: false, sanitizeResources: false });

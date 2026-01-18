/**
 * @fileoverview RTCClient 方法测试
 * 测试 RTCClient 的所有公共方法
 */

import { afterEach, beforeEach, describe, expect, it } from "@dreamer/test";
import { RTCClient } from "../src/client/mod.ts";
import {
  delay,
  getAvailablePort,
  waitForPortRelease,
  waitForServerReady,
} from "./test-utils.ts";
import { SignalingServer } from "../src/server/mod.ts";

describe("RTCClient 方法测试", () => {
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

  describe("媒体流方法", () => {
    it("getUserMedia 方法存在", () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      expect(typeof client.getUserMedia).toBe("function");
      client.disconnect();
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });

    it("getDisplayMedia 方法存在", () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      expect(typeof client.getDisplayMedia).toBe("function");
      client.disconnect();
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });
  });

  describe("数据通道方法", () => {
    it("createDataChannel 方法存在", () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      expect(typeof client.createDataChannel).toBe("function");
      client.disconnect();
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });
  });

  describe("房间管理方法", () => {
    it("joinRoom 方法存在", () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      expect(typeof client.joinRoom).toBe("function");
      client.disconnect();
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });

    it("leaveRoom 方法存在", () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      expect(typeof client.leaveRoom).toBe("function");
      client.disconnect();
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });
  });

  describe("连接管理方法", () => {
    it("connect 方法存在", () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      expect(typeof client.connect).toBe("function");
      client.disconnect();
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });

    it("disconnect 方法存在", () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      expect(typeof client.disconnect).toBe("function");
      client.disconnect();
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });
  });

  describe("状态查询方法", () => {
    it("getConnectionState 方法存在", () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      expect(typeof client.getConnectionState).toBe("function");
      client.disconnect();
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });

    it("getICEConnectionState 方法存在", () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      expect(typeof client.getICEConnectionState).toBe("function");
      client.disconnect();
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });

    it("getLocalStream 方法存在", () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      expect(typeof client.getLocalStream).toBe("function");
      client.disconnect();
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });

    it("getRemoteStream 方法存在", () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      expect(typeof client.getRemoteStream).toBe("function");
      client.disconnect();
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });
  });

  describe("统计信息方法", () => {
    it("getStats 方法存在", () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      expect(typeof client.getStats).toBe("function");
      client.disconnect();
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });

    it("resetStats 方法存在", () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      expect(typeof client.resetStats).toBe("function");
      client.disconnect();
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });

    it("getNetworkStats 方法存在", () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      expect(typeof client.getNetworkStats).toBe("function");
      client.disconnect();
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });

    it("getConnectionPoolStats 方法存在", () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      expect(typeof client.getConnectionPoolStats).toBe("function");
      client.disconnect();
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });
  });

  describe("事件系统方法", () => {
    it("on 方法存在", () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      expect(typeof client.on).toBe("function");
      client.disconnect();
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });

    it("off 方法存在", () => {
      const client = new RTCClient({
        signalingUrl: serverUrl,
        autoConnect: false,
      });
      expect(typeof client.off).toBe("function");
      client.disconnect();
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });
  });
});

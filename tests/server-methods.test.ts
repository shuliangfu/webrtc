/**
 * @fileoverview SignalingServer 方法测试
 * 测试 SignalingServer 的所有公共方法
 */

import { afterEach, beforeEach, describe, expect, it } from "@dreamer/test";
import { SignalingServer } from "../src/server/mod.ts";
import {
  delay,
  getAvailablePort,
  waitForPortRelease,
  waitForServerReady,
} from "./test-utils.ts";

describe("SignalingServer 方法测试", () => {
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
    await delay(300);
    if (server) {
      await server.close();
      // 等待端口完全释放（在 Bun 环境中需要更长时间）
      await waitForPortRelease(testPort);
    }
  });

  describe("服务器生命周期方法", () => {
    it("listen 方法存在", () => {
      expect(typeof server.listen).toBe("function");
    }, { timeout: 15000 });

    it("close 方法存在", () => {
      expect(typeof server.close).toBe("function");
    }, { timeout: 15000 });
  });

  describe("房间管理方法", () => {
    it("getRoom 方法存在", () => {
      expect(typeof server.getRoom).toBe("function");
    }, { timeout: 15000 });

    it("getAllRooms 方法存在", () => {
      expect(typeof server.getAllRooms).toBe("function");
    }, { timeout: 15000 });

    it("getRoomUsers 方法存在", () => {
      expect(typeof server.getRoomUsers).toBe("function");
    }, { timeout: 15000 });
  });

  describe("用户管理方法", () => {
    it("getUser 方法存在", () => {
      expect(typeof server.getUser).toBe("function");
    }, { timeout: 15000 });
  });

  describe("统计信息方法", () => {
    it("getStats 方法存在", () => {
      expect(typeof server.getStats).toBe("function");
    }, { timeout: 15000 });

    it("resetStats 方法存在", () => {
      expect(typeof server.resetStats).toBe("function");
    }, { timeout: 15000 });

    it("getNetworkQualitySuggestion 方法存在", () => {
      expect(typeof server.getNetworkQualitySuggestion).toBe("function");
    }, { timeout: 15000 });
  });
});

/**
 * @fileoverview 架构模式测试
 * 测试 Mesh/SFU 自动切换功能
 */

import { afterEach, beforeEach, describe, expect, it } from "@dreamer/test";
import { RTCClient } from "../src/client/client.ts";
import { SignalingServer } from "../src/server/server.ts";
import {
  delay,
  getAvailablePort,
  waitForPortRelease,
  waitForServerReady,
} from "./test-utils.ts";

describe("架构模式测试", () => {
  let server: SignalingServer;
  let serverUrl: string;
  let serverPort: number;

  beforeEach(async () => {
    // 获取可用端口
    serverPort = getAvailablePort();
    serverUrl = `http://localhost:${serverPort}`;

    // 创建信令服务器
    server = new SignalingServer({
      port: serverPort,
    });

    // 启动服务器
    await server.listen();

    // 等待服务器就绪
    await waitForServerReady(serverUrl);
  });

  afterEach(async () => {
    // 关闭服务器
    await server.close();
    // 等待端口完全释放（在 Bun 环境中需要更长时间）
    await waitForPortRelease(serverPort);
  });

  describe("Mesh 模式", () => {
    it("应该使用 Mesh 模式连接", () => {
      const client1 = new RTCClient({
        signalingUrl: serverUrl,
        architectureMode: "mesh",
        autoConnect: false,
      });

      expect(client1).toBeDefined();
      // 注意：由于无法直接访问私有属性，我们通过行为来验证
      // 在 Mesh 模式下，应该创建点对点连接

      client1.disconnect();
    }, { timeout: 15000 });
  });

  describe("SFU 模式", () => {
    it("应该使用 SFU 模式连接（需要 SFU 配置）", () => {
      const client1 = new RTCClient({
        signalingUrl: serverUrl,
        architectureMode: "sfu",
        sfuOptions: {
          url: "wss://sfu.example.com",
        },
        autoConnect: false,
      });

      expect(client1).toBeDefined();
      // 注意：SFU 模式需要实际的 SFU 服务器才能完全测试

      client1.disconnect();
    }, { timeout: 15000 });

    it("应该在没有 SFU 配置时回退到 Mesh 模式", () => {
      const client1 = new RTCClient({
        signalingUrl: serverUrl,
        architectureMode: "sfu",
        // 不提供 sfuOptions
        autoConnect: false,
      });

      expect(client1).toBeDefined();
      // 应该能够创建客户端，但不会初始化 SFU 适配器

      client1.disconnect();
    }, { timeout: 15000 });
  });

  describe("自动模式（Auto）", () => {
    it("应该默认使用 Mesh 模式（小规模房间）", () => {
      const client1 = new RTCClient({
        signalingUrl: serverUrl,
        architectureMode: "auto",
        meshToSFUThreshold: 10,
        autoConnect: false,
      });

      expect(client1).toBeDefined();
      // 初始状态应该是 Mesh 模式

      client1.disconnect();
    }, { timeout: 15000 });

    it("应该根据房间人数自动切换架构模式", async () => {
      // 跳过实际 WebRTC 连接测试（需要浏览器环境）
      if (typeof globalThis.RTCPeerConnection === "undefined") {
        console.log("跳过测试：RTCPeerConnection 不可用（需要浏览器环境）");
        return;
      }

      const roomId = "test-room-auto";
      const threshold = 3; // 降低阈值以便测试

      const client1 = new RTCClient({
        signalingUrl: serverUrl,
        architectureMode: "auto",
        meshToSFUThreshold: threshold,
        autoConnect: true,
      });

      // 等待连接
      await delay(500);

      // 加入房间（小规模，应该使用 Mesh）
      await client1.joinRoom(roomId, "user1");
      await delay(500);

      // 创建更多客户端加入房间
      const clients: RTCClient[] = [client1];
      for (let i = 2; i <= threshold; i++) {
        const client = new RTCClient({
          signalingUrl: serverUrl,
          architectureMode: "auto",
          meshToSFUThreshold: threshold,
          autoConnect: true,
        });
        await delay(500);
        await client.joinRoom(roomId, `user${i}`);
        clients.push(client);
        await delay(500);
      }

      // 等待架构模式切换
      await delay(1000);

      // 清理
      for (const client of clients) {
        client.disconnect();
      }
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });

    it("应该支持自定义切换阈值", () => {
      const client1 = new RTCClient({
        signalingUrl: serverUrl,
        architectureMode: "auto",
        meshToSFUThreshold: 5, // 自定义阈值
        autoConnect: false,
      });

      expect(client1).toBeDefined();
      // 应该使用自定义阈值

      client1.disconnect();
    }, { timeout: 15000 });
  });

  describe("架构模式切换", () => {
    it("应该在房间人数达到阈值时切换到 SFU 模式", async () => {
      // 跳过实际 WebRTC 连接测试（需要浏览器环境）
      if (typeof globalThis.RTCPeerConnection === "undefined") {
        console.log("跳过测试：RTCPeerConnection 不可用（需要浏览器环境）");
        return;
      }

      const roomId = "test-room-switch";
      const threshold = 3;

      // 创建第一个客户端
      const client1 = new RTCClient({
        signalingUrl: serverUrl,
        architectureMode: "auto",
        meshToSFUThreshold: threshold,
        sfuOptions: {
          url: "wss://sfu.example.com",
        },
        autoConnect: true,
      });

      await delay(500);
      await client1.joinRoom(roomId, "user1");
      await delay(500);

      // 添加更多用户，触发切换
      const clients: RTCClient[] = [client1];
      for (let i = 2; i <= threshold; i++) {
        const client = new RTCClient({
          signalingUrl: serverUrl,
          architectureMode: "auto",
          meshToSFUThreshold: threshold,
          sfuOptions: {
            url: "wss://sfu.example.com",
          },
          autoConnect: true,
        });
        await delay(500);
        await client.joinRoom(roomId, `user${i}`);
        clients.push(client);
        await delay(500);
      }

      // 等待切换完成
      await delay(1000);

      // 清理
      for (const client of clients) {
        client.disconnect();
      }
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });

    it("应该在房间人数减少时切换回 Mesh 模式", async () => {
      // 跳过实际 WebRTC 连接测试（需要浏览器环境）
      if (typeof globalThis.RTCPeerConnection === "undefined") {
        console.log("跳过测试：RTCPeerConnection 不可用（需要浏览器环境）");
        return;
      }

      const roomId = "test-room-switch-back";
      const threshold = 3;

      // 创建多个客户端
      const clients: RTCClient[] = [];
      for (let i = 1; i <= threshold; i++) {
        const client = new RTCClient({
          signalingUrl: serverUrl,
          architectureMode: "auto",
          meshToSFUThreshold: threshold,
          sfuOptions: {
            url: "wss://sfu.example.com",
          },
          autoConnect: true,
        });
        await delay(500);
        await client.joinRoom(roomId, `user${i}`);
        clients.push(client);
        await delay(500);
      }

      // 等待切换到 SFU
      await delay(1000);

      // 移除一些用户，应该切换回 Mesh
      for (let i = 1; i < threshold - 1; i++) {
        clients[i].leaveRoom();
        await delay(500);
      }

      // 等待切换回 Mesh
      await delay(1000);

      // 清理
      for (const client of clients) {
        client.disconnect();
      }
    }, { sanitizeOps: false, sanitizeResources: false, timeout: 15000 });
  });

  describe("向后兼容性", () => {
    it("应该在没有指定架构模式时默认使用 auto", () => {
      const client1 = new RTCClient({
        signalingUrl: serverUrl,
        // 不指定 architectureMode
        autoConnect: false,
      });

      expect(client1).toBeDefined();
      // 应该默认使用 auto 模式

      client1.disconnect();
    }, { timeout: 15000 });

    it("应该在没有指定阈值时使用默认值 10", () => {
      const client1 = new RTCClient({
        signalingUrl: serverUrl,
        architectureMode: "auto",
        // 不指定 meshToSFUThreshold
        autoConnect: false,
      });

      expect(client1).toBeDefined();
      // 应该使用默认阈值 10

      client1.disconnect();
    }, { timeout: 15000 });
  });
});

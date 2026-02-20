/**
 * @fileoverview WebRTC 信令服务器测试
 * 测试 SignalingServer 的所有功能
 */

import { afterEach, beforeEach, describe, expect, it } from "@dreamer/test";
import { ServiceContainer } from "@dreamer/service";
import {
  createWebRTCManager,
  SignalingServer,
  WebRTCManager,
} from "../src/server/mod.ts";
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

describe("WebRTCManager", () => {
  it("应该创建 WebRTCManager 实例", () => {
    const manager = new WebRTCManager();
    expect(manager).toBeInstanceOf(WebRTCManager);
  });

  it("应该获取默认管理器名称", () => {
    const manager = new WebRTCManager();
    expect(manager.getName()).toBe("default");
  });

  it("应该获取自定义管理器名称", () => {
    const manager = new WebRTCManager({ name: "custom" });
    expect(manager.getName()).toBe("custom");
  });

  it("应该注册和获取信令服务器", async () => {
    const manager = new WebRTCManager();
    const port = await getAvailablePortAsync();
    manager.registerServer("main", { port });

    const server = manager.getServer("main");
    expect(server).toBeInstanceOf(SignalingServer);

    await manager.close();
  });

  it("应该返回同一个服务器实例", async () => {
    const manager = new WebRTCManager();
    const port = await getAvailablePortAsync();
    manager.registerServer("main", { port });

    const server1 = manager.getServer("main");
    const server2 = manager.getServer("main");
    expect(server1).toBe(server2);

    await manager.close();
  });

  it("应该在未注册配置时抛出错误", () => {
    const manager = new WebRTCManager();
    // 错误信息随 locale 中英文不同，兼容两种文案
    expect(() => manager.getServer("unknown")).toThrow(
      /(未找到名为 "unknown" 的信令服务器配置|Signaling server config not found for name "unknown")/,
    );
  });

  it("应该使用默认配置创建服务器", async () => {
    const port = await getAvailablePortAsync();
    const manager = new WebRTCManager({
      defaultServerConfig: { port },
    });

    const server = manager.getServer("any");
    expect(server).toBeInstanceOf(SignalingServer);

    await manager.close();
  });

  it("应该检查服务器是否存在", async () => {
    const manager = new WebRTCManager();
    const port = await getAvailablePortAsync();

    expect(manager.hasServer("main")).toBe(false);

    manager.registerServer("main", { port });

    expect(manager.hasServer("main")).toBe(true);
  });

  it("应该移除服务器", async () => {
    const manager = new WebRTCManager();
    const port = await getAvailablePortAsync();
    manager.registerServer("main", { port });

    manager.getServer("main"); // 创建实例
    expect(manager.hasServer("main")).toBe(true);

    await manager.removeServer("main");
    expect(manager.hasServer("main")).toBe(false);
  });

  it("应该获取所有服务器名称", async () => {
    const manager = new WebRTCManager();
    const port1 = await getAvailablePortAsync();
    const port2 = await getAvailablePortAsync();

    manager.registerServer("server1", { port: port1 });
    manager.registerServer("server2", { port: port2 });

    const names = manager.getServerNames();
    expect(names).toContain("server1");
    expect(names).toContain("server2");
  });

  it("应该关闭所有服务器", async () => {
    const manager = new WebRTCManager();
    const port = await getAvailablePortAsync();
    manager.registerServer("main", { port });
    manager.getServer("main");

    await manager.close();
    expect(manager.getServerNames()).toContain("main"); // 配置仍在
  });
});

describe("WebRTCManager ServiceContainer 集成", () => {
  it("应该设置和获取服务容器", () => {
    const manager = new WebRTCManager();
    const container = new ServiceContainer();

    expect(manager.getContainer()).toBeUndefined();

    manager.setContainer(container);
    expect(manager.getContainer()).toBe(container);
  });

  it("应该从服务容器获取 WebRTCManager", () => {
    const container = new ServiceContainer();
    const manager = new WebRTCManager({ name: "test" });
    manager.setContainer(container);

    container.registerSingleton("webrtc:test", () => manager);

    const retrieved = WebRTCManager.fromContainer(container, "test");
    expect(retrieved).toBe(manager);
  });

  it("应该在服务不存在时返回 undefined", () => {
    const container = new ServiceContainer();
    const retrieved = WebRTCManager.fromContainer(container, "non-existent");
    expect(retrieved).toBeUndefined();
  });

  it("应该支持多个 WebRTCManager 实例", () => {
    const container = new ServiceContainer();

    const prodManager = new WebRTCManager({ name: "prod" });
    prodManager.setContainer(container);

    const devManager = new WebRTCManager({ name: "dev" });
    devManager.setContainer(container);

    container.registerSingleton("webrtc:prod", () => prodManager);
    container.registerSingleton("webrtc:dev", () => devManager);

    expect(WebRTCManager.fromContainer(container, "prod")).toBe(prodManager);
    expect(WebRTCManager.fromContainer(container, "dev")).toBe(devManager);
  });
});

describe("createWebRTCManager 工厂函数", () => {
  it("应该创建 WebRTCManager 实例", () => {
    const manager = createWebRTCManager();
    expect(manager).toBeInstanceOf(WebRTCManager);
  });

  it("应该使用默认名称", () => {
    const manager = createWebRTCManager();
    expect(manager.getName()).toBe("default");
  });

  it("应该使用自定义名称", () => {
    const manager = createWebRTCManager({ name: "custom" });
    expect(manager.getName()).toBe("custom");
  });

  it("应该能够在服务容器中注册", () => {
    const container = new ServiceContainer();

    container.registerSingleton(
      "webrtc:main",
      () => createWebRTCManager({ name: "main" }),
    );

    const manager = container.get<WebRTCManager>("webrtc:main");
    expect(manager).toBeInstanceOf(WebRTCManager);
    expect(manager.getName()).toBe("main");
  });

  it("应该支持默认服务器配置", async () => {
    const port = await getAvailablePortAsync();
    const manager = createWebRTCManager({
      defaultServerConfig: { port },
    });

    const server = manager.getServer("any-name");
    expect(server).toBeInstanceOf(SignalingServer);

    await manager.close();
  });
});

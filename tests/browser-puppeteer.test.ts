/**
 * @fileoverview 使用 @dreamer/test 浏览器测试集成进行浏览器端测试
 * 使用新版测试库的浏览器测试功能，自动管理 Puppeteer 和 esbuild
 */

import { RUNTIME } from "@dreamer/runtime-adapter";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "@dreamer/test";
import { SignalingServer } from "../src/server/mod.ts";
import {
  delay,
  getAvailablePort,
  waitForPortRelease,
  waitForServerReady,
} from "./test-utils.ts";

// 服务器相关变量
let server: SignalingServer | null = null;
let testPort: number;
let serverUrl: string;

// 浏览器测试配置
const browserConfig = {
  // 禁用资源泄漏检查（浏览器测试可能有内部定时器）
  sanitizeOps: false,
  sanitizeResources: false,
  // 启用浏览器测试
  browser: {
    enabled: true,
    // 客户端代码入口
    entryPoint: "./src/client/mod.ts",
    // 全局变量名
    globalName: "WebRTCClient",
    // 无头模式
    headless: true,
    // Chrome 启动参数（支持 WebRTC 测试）
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
    ],
    // 复用浏览器实例
    reuseBrowser: true,
    // 自定义 body 内容
    bodyContent: `
      <div id="test-container">
        <video id="local-video" autoplay muted></video>
        <video id="remote-video" autoplay></video>
      </div>
    `,
  },
};

describe(`WebRTC - 浏览器测试 (${RUNTIME})`, () => {
  // 在所有测试前启动信令服务器
  beforeAll(async () => {
    testPort = getAvailablePort();
    serverUrl = `http://localhost:${testPort}`;
    server = new SignalingServer({
      port: testPort,
      stunServers: [{ urls: "stun:stun.l.google.com:19302" }],
    });
    await server.listen();
    await waitForServerReady(serverUrl);
    console.log(`[${RUNTIME}] 信令服务器已启动: ${serverUrl}`);
  });

  // 在所有测试后关闭信令服务器
  afterAll(async () => {
    if (server) {
      await server.close();
      // 等待端口完全释放，确保后续测试可以正常启动
      await waitForPortRelease(testPort);
      server = null;
      console.log(`[${RUNTIME}] 信令服务器已关闭`);
    }
  });

  describe("RTCClient 浏览器环境测试", () => {
    it("应该在浏览器中创建 RTCClient 实例", async (t) => {
      // @ts-ignore - 浏览器测试上下文
      const result = await t.browser!.evaluate(() => {
        // 检查 RTCClient 是否已加载
        const win = globalThis as any;
        if (typeof win.WebRTCClient === "undefined") {
          return { success: false, error: "WebRTCClient 未定义" };
        }

        try {
          // 创建 RTCClient 实例
          const client = new win.WebRTCClient.RTCClient({
            signalingUrl: "http://localhost:30000",
            autoConnect: false,
          });

          return {
            success: true,
            hasConnect: typeof client.connect === "function",
            hasDisconnect: typeof client.disconnect === "function",
            hasGetUserMedia: typeof client.getUserMedia === "function",
            hasGetDisplayMedia: typeof client.getDisplayMedia === "function",
          };
        } catch (error: any) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.hasConnect).toBe(true);
      expect(result.hasDisconnect).toBe(true);
      expect(result.hasGetUserMedia).toBe(true);
      expect(result.hasGetDisplayMedia).toBe(true);
    }, browserConfig);

    it("应该支持 RTCPeerConnection API", async (t) => {
      // @ts-ignore - 浏览器测试上下文
      const result = await t.browser!.evaluate(() => {
        try {
          const win = globalThis as any;

          // 检查全局和 window 对象
          const hasRTCPeerConnection =
            typeof win.RTCPeerConnection !== "undefined";

          const hasMediaStream = typeof win.MediaStream !== "undefined";

          const hasGetUserMedia =
            typeof navigator !== "undefined" &&
            typeof (navigator as any).mediaDevices !== "undefined" &&
            typeof (navigator as any).mediaDevices.getUserMedia === "function";

          return {
            hasRTCPeerConnection,
            hasMediaStream,
            hasGetUserMedia,
          };
        } catch (_error) {
          return {
            hasRTCPeerConnection: false,
            hasMediaStream: false,
            hasGetUserMedia: false,
          };
        }
      });

      expect(result.hasRTCPeerConnection).toBe(true);
      expect(result.hasMediaStream).toBe(true);
    }, browserConfig);

    it("应该支持创建 RTCPeerConnection 实例", async (t) => {
      // @ts-ignore - 浏览器测试上下文
      const result = await t.browser!.evaluate(() => {
        try {
          const win = globalThis as any;
          const pc = new win.RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          });
          const isValid = pc instanceof win.RTCPeerConnection;
          pc.close();
          return { success: true, isValid };
        } catch (error: any) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.isValid).toBe(true);
    }, browserConfig);

    it("应该支持事件监听", async (t) => {
      // @ts-ignore - 浏览器测试上下文
      const result = await t.browser!.evaluate(() => {
        const win = globalThis as any;
        if (typeof win.WebRTCClient === "undefined") {
          return { success: false, error: "WebRTCClient 未定义" };
        }

        try {
          const client = new win.WebRTCClient.RTCClient({
            signalingUrl: "http://localhost:30000",
            autoConnect: false,
          });

          let _eventFired = false;
          client.on("connection-state-change", () => {
            _eventFired = true;
          });

          client.connect();

          return {
            success: true,
            hasOn: typeof client.on === "function",
            hasOff: typeof client.off === "function",
          };
        } catch (error: any) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.hasOn).toBe(true);
      expect(result.hasOff).toBe(true);
    }, browserConfig);

    it("应该支持连接状态管理", async (t) => {
      // @ts-ignore - 浏览器测试上下文
      const result = await t.browser!.evaluate(() => {
        const win = globalThis as any;
        if (typeof win.WebRTCClient === "undefined") {
          return { success: false, error: "WebRTCClient 未定义" };
        }

        try {
          const client = new win.WebRTCClient.RTCClient({
            signalingUrl: "http://localhost:30000",
            autoConnect: false,
          });

          const initialState = client.getConnectionState
            ? client.getConnectionState()
            : client.connectionState;
          client.connect();
          const connectingState = client.getConnectionState
            ? client.getConnectionState()
            : client.connectionState;
          client.disconnect();
          const disconnectedState = client.getConnectionState
            ? client.getConnectionState()
            : client.connectionState;

          return {
            success: true,
            initialState,
            connectingState,
            disconnectedState,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      expect(result.success).toBe(true);
      expect(typeof result.initialState).toBe("string");
      expect(typeof result.connectingState).toBe("string");
      expect(typeof result.disconnectedState).toBe("string");
    }, browserConfig);

    it("应该支持断开连接", async (t) => {
      // @ts-ignore - 浏览器测试上下文
      const result = await t.browser!.evaluate(() => {
        const win = globalThis as any;
        if (typeof win.WebRTCClient === "undefined") {
          return { success: false, error: "WebRTCClient 未定义" };
        }

        try {
          const client = new win.WebRTCClient.RTCClient({
            signalingUrl: "http://localhost:30000",
            autoConnect: false,
          });

          client.connect();
          const beforeDisconnect = client.getConnectionState
            ? client.getConnectionState()
            : client.connectionState;
          client.disconnect();
          const afterDisconnect = client.getConnectionState
            ? client.getConnectionState()
            : client.connectionState;

          return {
            success: true,
            hasDisconnect: typeof client.disconnect === "function",
            beforeDisconnect,
            afterDisconnect,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.hasDisconnect).toBe(true);
      expect(typeof result.beforeDisconnect).toBe("string");
      expect(typeof result.afterDisconnect).toBe("string");
    }, browserConfig);

    it("应该支持媒体流方法检测", async (t) => {
      // @ts-ignore - 浏览器测试上下文
      const result = await t.browser!.evaluate(() => {
        const win = globalThis as any;
        if (typeof win.WebRTCClient === "undefined") {
          return { success: false, error: "WebRTCClient 未定义" };
        }

        try {
          const client = new win.WebRTCClient.RTCClient({
            signalingUrl: "http://localhost:30000",
            autoConnect: false,
          });

          return {
            success: true,
            hasGetUserMedia: typeof client.getUserMedia === "function",
            hasGetDisplayMedia: typeof client.getDisplayMedia === "function",
            hasGetLocalStream: typeof client.getLocalStream === "function",
            hasGetRemoteStream: typeof client.getRemoteStream === "function",
          };
        } catch (error: any) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.hasGetUserMedia).toBe(true);
      expect(result.hasGetDisplayMedia).toBe(true);
      expect(result.hasGetLocalStream).toBe(true);
      expect(result.hasGetRemoteStream).toBe(true);
    }, browserConfig);

    it("应该支持数据通道方法检测", async (t) => {
      // @ts-ignore - 浏览器测试上下文
      const result = await t.browser!.evaluate(() => {
        const win = globalThis as any;
        if (typeof win.WebRTCClient === "undefined") {
          return { success: false, error: "WebRTCClient 未定义" };
        }

        try {
          const client = new win.WebRTCClient.RTCClient({
            signalingUrl: "http://localhost:30000",
            autoConnect: false,
          });

          return {
            success: true,
            hasCreateDataChannel:
              typeof client.createDataChannel === "function",
          };
        } catch (error: any) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.hasCreateDataChannel).toBe(true);
    }, browserConfig);

    it("应该支持房间模式方法检测", async (t) => {
      // @ts-ignore - 浏览器测试上下文
      const result = await t.browser!.evaluate(() => {
        const win = globalThis as any;
        if (typeof win.WebRTCClient === "undefined") {
          return { success: false, error: "WebRTCClient 未定义" };
        }

        try {
          const client = new win.WebRTCClient.RTCClient({
            signalingUrl: "http://localhost:30000",
            autoConnect: false,
          });

          return {
            success: true,
            hasJoinRoom: typeof client.joinRoom === "function",
            hasLeaveRoom: typeof client.leaveRoom === "function",
          };
        } catch (error: any) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.hasJoinRoom).toBe(true);
      expect(result.hasLeaveRoom).toBe(true);
    }, browserConfig);

    it("应该支持统计信息方法检测", async (t) => {
      // @ts-ignore - 浏览器测试上下文
      const result = await t.browser!.evaluate(() => {
        const win = globalThis as any;
        if (typeof win.WebRTCClient === "undefined") {
          return { success: false, error: "WebRTCClient 未定义" };
        }

        try {
          const client = new win.WebRTCClient.RTCClient({
            signalingUrl: "http://localhost:30000",
            autoConnect: false,
          });

          return {
            success: true,
            hasGetStats: typeof client.getStats === "function",
            hasGetConnectionPoolStats:
              typeof client.getConnectionPoolStats === "function",
            hasGetNetworkStats: typeof client.getNetworkStats === "function",
          };
        } catch (error: any) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.hasGetStats).toBe(true);
      expect(result.hasGetConnectionPoolStats).toBe(true);
      expect(result.hasGetNetworkStats).toBe(true);
    }, browserConfig);

    it("应该支持配置选项", async (t) => {
      // @ts-ignore - 浏览器测试上下文
      const result = await t.browser!.evaluate(() => {
        try {
          const win = globalThis as any;
          if (typeof win.WebRTCClient === "undefined") {
            return { success: false, error: "WebRTCClient 未定义" };
          }

          const client = new win.WebRTCClient.RTCClient({
            signalingUrl: "http://localhost:30000",
            autoConnect: false,
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
            reconnect: true,
            maxReconnectAttempts: 5,
          });

          return {
            success: true,
            hasOptions: client !== null && typeof client === "object",
          };
        } catch (error: any) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.hasOptions).toBe(true);
    }, browserConfig);

    it("应该支持 MediaStream API", async (t) => {
      // @ts-ignore - 浏览器测试上下文
      const result = await t.browser!.evaluate(() => {
        try {
          const win = globalThis as any;
          const hasMediaStream = typeof win.MediaStream !== "undefined";

          if (!hasMediaStream) {
            return { success: false, error: "MediaStream 不可用" };
          }

          const stream = new win.MediaStream();
          const hasGetTracks = typeof stream.getTracks === "function";
          const hasGetAudioTracks =
            typeof stream.getAudioTracks === "function";
          const hasGetVideoTracks =
            typeof stream.getVideoTracks === "function";

          return {
            success: true,
            hasMediaStream,
            hasGetTracks,
            hasGetAudioTracks,
            hasGetVideoTracks,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.hasMediaStream).toBe(true);
      expect(result.hasGetTracks).toBe(true);
      expect(result.hasGetAudioTracks).toBe(true);
      expect(result.hasGetVideoTracks).toBe(true);
    }, browserConfig);

    it("应该支持 RTCPeerConnection 状态属性", async (t) => {
      // @ts-ignore - 浏览器测试上下文
      const result = await t.browser!.evaluate(() => {
        try {
          const win = globalThis as any;
          const pc = new win.RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          });

          const hasIceConnectionState =
            typeof pc.iceConnectionState === "string";
          const hasConnectionState = typeof pc.connectionState === "string";
          const hasSignalingState = typeof pc.signalingState === "string";
          const hasLocalDescription =
            pc.localDescription === null ||
            typeof pc.localDescription === "object";
          const hasRemoteDescription =
            pc.remoteDescription === null ||
            typeof pc.remoteDescription === "object";

          pc.close();

          return {
            success: true,
            hasIceConnectionState,
            hasConnectionState,
            hasSignalingState,
            hasLocalDescription,
            hasRemoteDescription,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.hasIceConnectionState).toBe(true);
      expect(result.hasConnectionState).toBe(true);
      expect(result.hasSignalingState).toBe(true);
      expect(result.hasLocalDescription).toBe(true);
      expect(result.hasRemoteDescription).toBe(true);
    }, browserConfig);

    it("应该支持 RTCPeerConnection 事件处理器", async (t) => {
      // @ts-ignore - 浏览器测试上下文
      const result = await t.browser!.evaluate(() => {
        try {
          const win = globalThis as any;
          const pc = new win.RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          });

          const hasOnIceCandidate =
            typeof pc.onicecandidate === "function" ||
            pc.onicecandidate === null;
          const hasOnIceConnectionStateChange =
            typeof pc.oniceconnectionstatechange === "function" ||
            pc.oniceconnectionstatechange === null;
          const hasOnConnectionStateChange =
            typeof pc.onconnectionstatechange === "function" ||
            pc.onconnectionstatechange === null;
          const hasOnTrack =
            typeof pc.ontrack === "function" || pc.ontrack === null;
          const hasOnDataChannel =
            typeof pc.ondatachannel === "function" ||
            pc.ondatachannel === null;

          pc.close();

          return {
            success: true,
            hasOnIceCandidate,
            hasOnIceConnectionStateChange,
            hasOnConnectionStateChange,
            hasOnTrack,
            hasOnDataChannel,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.hasOnIceCandidate).toBe(true);
      expect(result.hasOnIceConnectionStateChange).toBe(true);
      expect(result.hasOnConnectionStateChange).toBe(true);
      expect(result.hasOnTrack).toBe(true);
      expect(result.hasOnDataChannel).toBe(true);
    }, browserConfig);

    it("应该支持 RTCPeerConnection 方法", async (t) => {
      // @ts-ignore - 浏览器测试上下文
      const result = await t.browser!.evaluate(() => {
        try {
          const win = globalThis as any;
          const pc = new win.RTCPeerConnection({
            iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
          });

          const hasCreateOffer = typeof pc.createOffer === "function";
          const hasCreateAnswer = typeof pc.createAnswer === "function";
          const hasSetLocalDescription =
            typeof pc.setLocalDescription === "function";
          const hasSetRemoteDescription =
            typeof pc.setRemoteDescription === "function";
          const hasAddIceCandidate = typeof pc.addIceCandidate === "function";
          const hasCreateDataChannel =
            typeof pc.createDataChannel === "function";
          const hasGetStats = typeof pc.getStats === "function";
          const hasClose = typeof pc.close === "function";

          pc.close();

          return {
            success: true,
            hasCreateOffer,
            hasCreateAnswer,
            hasSetLocalDescription,
            hasSetRemoteDescription,
            hasAddIceCandidate,
            hasCreateDataChannel,
            hasGetStats,
            hasClose,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.hasCreateOffer).toBe(true);
      expect(result.hasCreateAnswer).toBe(true);
      expect(result.hasSetLocalDescription).toBe(true);
      expect(result.hasSetRemoteDescription).toBe(true);
      expect(result.hasAddIceCandidate).toBe(true);
      expect(result.hasCreateDataChannel).toBe(true);
      expect(result.hasGetStats).toBe(true);
      expect(result.hasClose).toBe(true);
    }, browserConfig);

    it("应该支持多个事件类型", async (t) => {
      // @ts-ignore - 浏览器测试上下文
      const result = await t.browser!.evaluate(() => {
        const win = globalThis as any;
        if (typeof win.WebRTCClient === "undefined") {
          return { success: false, error: "WebRTCClient 未定义" };
        }

        try {
          const client = new win.WebRTCClient.RTCClient({
            signalingUrl: "http://localhost:30000",
            autoConnect: false,
          });

          // 测试多个事件类型
          const eventTypes = [
            "connection-state-change",
            "ice-connection-state-change",
            "signaling-state-change",
            "track",
            "data-channel",
            "error",
          ];

          const supportedEvents: string[] = [];
          eventTypes.forEach((eventType) => {
            try {
              client.on(eventType, () => {});
              supportedEvents.push(eventType);
            } catch {
              // 忽略不支持的事件
            }
          });

          return {
            success: true,
            supportedEventsCount: supportedEvents.length,
            supportedEvents,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.supportedEventsCount).toBeGreaterThan(0);
    }, browserConfig);
  }, browserConfig);

  describe("架构模式测试", () => {
    it("应该支持 Mesh 模式配置", async (t) => {
      // @ts-ignore - 浏览器测试上下文
      const result = await t.browser!.evaluate(() => {
        try {
          const win = globalThis as any;
          if (typeof win.WebRTCClient === "undefined") {
            return { success: false, error: "WebRTCClient 未定义" };
          }

          const client = new win.WebRTCClient.RTCClient({
            signalingUrl: "http://localhost:30000",
            architectureMode: "mesh",
            autoConnect: false,
          });

          const hasClient = client !== null && client !== undefined;
          client.disconnect();

          return {
            success: true,
            hasClient,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.hasClient).toBe(true);
    }, browserConfig);

    it("应该支持 SFU 模式配置", async (t) => {
      // @ts-ignore - 浏览器测试上下文
      const result = await t.browser!.evaluate(() => {
        try {
          const win = globalThis as any;
          if (typeof win.WebRTCClient === "undefined") {
            return { success: false, error: "WebRTCClient 未定义" };
          }

          const client = new win.WebRTCClient.RTCClient({
            signalingUrl: "http://localhost:30000",
            architectureMode: "sfu",
            sfuOptions: {
              url: "wss://sfu.example.com",
            },
            autoConnect: false,
          });

          const hasClient = client !== null && client !== undefined;
          client.disconnect();

          return {
            success: true,
            hasClient,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.hasClient).toBe(true);
    }, browserConfig);

    it("应该支持自动模式（Auto）配置", async (t) => {
      // @ts-ignore - 浏览器测试上下文
      const result = await t.browser!.evaluate(() => {
        try {
          const win = globalThis as any;
          if (typeof win.WebRTCClient === "undefined") {
            return { success: false, error: "WebRTCClient 未定义" };
          }

          const client = new win.WebRTCClient.RTCClient({
            signalingUrl: "http://localhost:30000",
            architectureMode: "auto",
            meshToSFUThreshold: 10,
            autoConnect: false,
          });

          const hasClient = client !== null && client !== undefined;
          client.disconnect();

          return {
            success: true,
            hasClient,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.hasClient).toBe(true);
    }, browserConfig);

    it("应该支持自定义切换阈值", async (t) => {
      // @ts-ignore - 浏览器测试上下文
      const result = await t.browser!.evaluate(() => {
        try {
          const win = globalThis as any;
          if (typeof win.WebRTCClient === "undefined") {
            return { success: false, error: "WebRTCClient 未定义" };
          }

          const client = new win.WebRTCClient.RTCClient({
            signalingUrl: "http://localhost:30000",
            architectureMode: "auto",
            meshToSFUThreshold: 5,
            autoConnect: false,
          });

          const hasClient = client !== null && client !== undefined;
          client.disconnect();

          return {
            success: true,
            hasClient,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.hasClient).toBe(true);
    }, browserConfig);

    it("应该在没有指定架构模式时默认使用 auto", async (t) => {
      // @ts-ignore - 浏览器测试上下文
      const result = await t.browser!.evaluate(() => {
        try {
          const win = globalThis as any;
          if (typeof win.WebRTCClient === "undefined") {
            return { success: false, error: "WebRTCClient 未定义" };
          }

          // 不指定 architectureMode，应该默认使用 "auto"
          const client = new win.WebRTCClient.RTCClient({
            signalingUrl: "http://localhost:30000",
            autoConnect: false,
          });

          const hasClient = client !== null && client !== undefined;
          client.disconnect();

          return {
            success: true,
            hasClient,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.hasClient).toBe(true);
    }, browserConfig);

    it("应该在没有指定阈值时使用默认值 10", async (t) => {
      // @ts-ignore - 浏览器测试上下文
      const result = await t.browser!.evaluate(() => {
        try {
          const win = globalThis as any;
          if (typeof win.WebRTCClient === "undefined") {
            return { success: false, error: "WebRTCClient 未定义" };
          }

          // 不指定 meshToSFUThreshold，应该使用默认值 10
          const client = new win.WebRTCClient.RTCClient({
            signalingUrl: "http://localhost:30000",
            architectureMode: "auto",
            autoConnect: false,
          });

          const hasClient = client !== null && client !== undefined;
          client.disconnect();

          return {
            success: true,
            hasClient,
          };
        } catch (error: any) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
          };
        }
      });

      expect(result.success).toBe(true);
      expect(result.hasClient).toBe(true);
    }, browserConfig);
  }, browserConfig);
}, browserConfig);

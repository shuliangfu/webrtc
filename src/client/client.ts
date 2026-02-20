/**
 * @module @dreamer/webrtc/client/client
 *
 * @fileoverview WebRTC 客户端
 * 浏览器端的 WebRTC 客户端实现，用于建立音视频通话连接
 */

import { Client as SocketIOClient } from "@dreamer/socket-io/client";
import type {
  ArchitectureMode,
  ConnectionState,
  EventCallback,
  ICEConnectionState,
  ICEServer,
  RTCClientOptions,
  RTCConfiguration,
  RTCEvent,
  SignalingMessage,
} from "../types.ts";
import { logger } from "./logger.ts";
import { SFUAdapter } from "./sfu-adapter.ts";
import type {
  MediaStream,
  MediaStreamConstraints,
  RTCDataChannel,
  RTCDataChannelInit,
  RTCIceCandidate,
  RTCPeerConnection,
} from "./types.ts";
import {
  MediaStream as MediaStreamConstructor,
  navigator,
  RTCIceCandidate as RTCIceCandidateConstructor,
  RTCSessionDescription as RTCSessionDescriptionConstructor,
} from "./types.ts";

/** 与 @dreamer/socket-io 的 on() 兼容：库要求 listener 为 (data: unknown) => void，此处用具类型回调再整体断言以保持业务侧类型清晰 */
type SocketOnListener = (data: unknown) => void;

/**
 * WebRTC 客户端
 * 用于浏览器端建立 WebRTC 音视频通话连接
 */
export class RTCClient {
  /** Socket.IO 客户端实例 */
  private socket: SocketIOClient;
  /** RTCPeerConnection 实例（点对点模式，单个连接） */
  private peerConnection?: RTCPeerConnection;
  /** 多人房间模式：对等体连接映射（userId -> RTCPeerConnection） */
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  /** 多人房间模式：远程媒体流映射（userId -> MediaStream） */
  private remoteStreams: Map<string, MediaStream> = new Map();
  /** 本地媒体流 */
  private localStream?: MediaStream;
  /** 远程媒体流（点对点模式，单个流） */
  private remoteStream?: MediaStream;
  /** ICE candidates 批量收集（用于优化） */
  private iceCandidates: Map<string, RTCIceCandidate[]> = new Map();
  /** ICE candidates 发送定时器 */
  private iceCandidateTimers: Map<string, number> = new Map();
  /** 是否启用多人房间模式 */
  private multiPeerMode: boolean = false;
  /** 已处理信令消息 ID（用于去重） */
  private processedSignalingIds: Set<string> = new Set();
  /** 连接统计信息 */
  private stats: {
    messagesSent: number;
    messagesReceived: number;
    errors: number;
    reconnections: number;
  } = {
    messagesSent: 0,
    messagesReceived: 0,
    errors: 0,
    reconnections: 0,
  };
  /** RTCPeerConnection 连接池 */
  private connectionPool: RTCPeerConnectionPool;
  /** 网络质量监控定时器 */
  private qualityMonitorTimer?: number;
  /** 当前媒体质量等级 */
  private currentQuality: "low" | "medium" | "high" = "high";
  /** 网络质量统计 */
  private networkStats: {
    bandwidth: number;
    packetLoss: number;
    rtt: number;
    lastUpdate: number;
  } = {
    bandwidth: 0,
    packetLoss: 0,
    rtt: 0,
    lastUpdate: 0,
  };
  /** 配置选项 */
  private options:
    & Required<
      Pick<
        RTCClientOptions,
        | "autoConnect"
        | "reconnect"
        | "reconnectInterval"
        | "maxReconnectAttempts"
      >
    >
    & RTCClientOptions;
  /** SFU 适配器实例 */
  private sfuAdapter?: SFUAdapter;
  /** 当前架构模式 */
  private currentArchitectureMode: ArchitectureMode = "mesh";
  /** 房间用户数（用于自动切换） */
  private roomUserCount: number = 0;
  /** 事件监听器 */
  private eventListeners: Map<RTCEvent, EventCallback[]> = new Map();
  /** 连接状态 */
  private connectionState: ConnectionState = "new";
  /** ICE 连接状态 */
  private iceConnectionState: ICEConnectionState = "new";
  /** 房间 ID */
  private roomId?: string;
  /** 用户 ID */
  private userId?: string;
  /** ICE 服务器配置 */
  private iceServers: ICEServer[] = [];
  /** 信令连接超时定时器 ID（用于在长时间未连接成功时主动失败，避免挂起） */
  private connectTimeoutId?: number;
  /** 信令连接超时时长（毫秒），超时后置为 failed 并断开，避免在无 WebRTC 或网络异常时无限等待 */
  private static readonly CONNECT_TIMEOUT_MS = 10_000;

  /**
   * 创建 WebRTC 客户端实例
   *
   * @param options - 客户端配置选项
   * @param options.signalingUrl - 信令服务器 URL（必需）
   * @param options.roomId - 房间 ID（可选）
   * @param options.userId - 用户 ID（可选）
   * @param options.rtcConfiguration - WebRTC 配置选项
   * @param options.mediaConstraints - 媒体流约束
   * @param options.autoConnect - 是否自动连接（默认：true）
   * @param options.reconnect - 是否自动重连（默认：true）
   * @param options.reconnectInterval - 重连间隔（默认：1000ms）
   * @param options.maxReconnectAttempts - 最大重连次数（默认：5）
   */
  constructor(options: RTCClientOptions) {
    this.options = {
      autoConnect: options.autoConnect !== false,
      reconnect: options.reconnect !== false,
      reconnectInterval: options.reconnectInterval || 1000,
      maxReconnectAttempts: options.maxReconnectAttempts || 5,
      architectureMode: options.architectureMode || "auto",
      meshToSFUThreshold: options.meshToSFUThreshold || 10,
      ...options,
    };

    // 设置当前架构模式
    const architectureMode = this.options.architectureMode || "auto";
    this.currentArchitectureMode = architectureMode === "auto"
      ? "mesh"
      : architectureMode;

    // 创建连接池
    this.connectionPool = new RTCPeerConnectionPool({
      maxSize: this.options.connectionPoolSize || 5,
    });

    // 创建 Socket.IO 客户端
    // Socket.IO 客户端会自动在 URL 后添加 /socket.io/，所以服务器也需要使用 /socket.io/ 路径
    this.socket = new SocketIOClient({
      url: this.options.signalingUrl,
      autoConnect: this.options.autoConnect, // 传递 autoConnect 选项，确保 Socket.IO 客户端不会自动连接
      autoReconnect: this.options.reconnect,
      reconnectionDelay: this.options.reconnectInterval,
      reconnectionDelayMax: this.options.reconnectInterval * 5,
      reconnectionAttempts: this.options.maxReconnectAttempts,
    });

    // 初始化 SFU 适配器（如果配置了 SFU）
    if (
      (this.options.architectureMode === "sfu" ||
        this.options.architectureMode === "auto") &&
      this.options.sfuOptions
    ) {
      this.sfuAdapter = new SFUAdapter(
        this.options.sfuOptions,
        this.options.rtcConfiguration,
      );
      this.sfuAdapter.setSignalingHandler((message) => {
        this.socket.emit("signaling", message);
      });
    }

    // 设置信令处理器
    this.setupSignalingHandlers();

    // 自动连接
    if (this.options.autoConnect) {
      this.connect();
    }
  }

  /**
   * 设置信令处理器
   *
   * 为 Socket.IO 客户端设置事件处理器，包括：
   * - `connect`: 连接成功时更新连接状态
   * - `ice-servers`: 接收 ICE 服务器配置并更新 RTC 配置
   * - `signaling`: 接收并处理信令消息（offer、answer、ice-candidate）
   * - `user-joined`: 处理其他用户加入房间事件
   * - `user-left`: 处理其他用户离开房间事件
   * - `room-joined`: 处理成功加入房间事件
   * - `disconnect`: 处理断开连接事件
   *
   * @private
   */
  private setupSignalingHandlers(): void {
    // 连接成功：清除连接超时定时器，并更新状态
    this.socket.on("connect", () => {
      if (this.connectTimeoutId != null) {
        clearTimeout(this.connectTimeoutId);
        this.connectTimeoutId = undefined;
      }
      logger.info("信令服务器连接成功");
      this.setConnectionState("connected");
    });

    // 接收 ICE 服务器配置（ClientEventListener 为 (data?: unknown) => void，回调内断言类型）
    this.socket.on("ice-servers", (data?: unknown) => {
      const d = data as { stunServers: ICEServer[]; turnServers: ICEServer[] };
      if (!d?.stunServers) return;
      this.iceServers = [...d.stunServers, ...(d.turnServers ?? [])];
      this.updateRTCConfiguration();
    });

    // 接收信令消息
    this.socket.on("signaling", async (data?: unknown) => {
      const message = data as SignalingMessage | undefined;
      if (!message) return;
      await this.handleSignaling(message);
    });

    // 用户加入房间
    this.socket.on("user-joined", (data?: unknown) => {
      const d = data as { userId: string; roomId: string } | undefined;
      if (!d) return;
      logger.info(`用户 ${d.userId} 加入房间 ${d.roomId}`);
      // 如果是新用户加入，且我们已经创建了 PeerConnection，需要创建 offer
      if (
        this.peerConnection && this.peerConnection.signalingState === "stable"
      ) {
        this.createOffer();
      }
    });

    // 用户离开房间
    this.socket.on("user-left", (data?: unknown) => {
      const d = data as { userId: string; roomId: string } | undefined;
      if (!d) return;
      logger.info(`用户 ${d.userId} 离开房间 ${d.roomId}`);

      // 如果是多人房间模式，清理对应的 PeerConnection
      if (this.multiPeerMode) {
        this.removePeerConnectionForUser(d.userId);
      }
    });

    // 房间加入成功
    this.socket.on("room-joined", (data?: unknown) => {
      const d = data as
        | { roomId: string; userId: string; users: string[] }
        | undefined;
      if (!d) return;
      logger.info(
        `加入房间成功: ${d.roomId}, 房间内用户: ${d.users.length}`,
      );
      this.roomId = d.roomId;
      this.userId = d.userId;
      this.roomUserCount = d.users.length + 1; // 包括自己

      // 检查是否需要切换架构模式
      if (this.options.architectureMode === "auto") {
        this.checkAndSwitchArchitecture();
      }

      // 如果是多人房间模式，为房间内其他用户创建 PeerConnection
      if (this.multiPeerMode && this.currentArchitectureMode === "mesh") {
        for (const otherUserId of d.users) {
          this.createPeerConnectionForUser(otherUserId);
        }
      }
    });

    // 用户加入房间（更新房间人数）
    this.socket.on("user-joined", (_data?: unknown) => {
      this.roomUserCount++;
      // 检查是否需要切换架构模式
      if (this.options.architectureMode === "auto") {
        this.checkAndSwitchArchitecture();
      }
    });

    // 用户离开房间（更新房间人数）
    this.socket.on("user-left", (_data?: unknown) => {
      this.roomUserCount = Math.max(0, this.roomUserCount - 1);
      // 检查是否需要切换架构模式
      if (this.options.architectureMode === "auto") {
        this.checkAndSwitchArchitecture();
      }
    });

    // 接收架构模式切换通知
    this.socket.on("architecture-mode", (data?: unknown) => {
      const d = data as { architectureMode: ArchitectureMode } | undefined;
      if (!d) return;
      if (d.architectureMode !== this.currentArchitectureMode) {
        this.switchArchitecture(d.architectureMode);
      }
    });

    // 连接断开
    this.socket.on("disconnect", (reason?: unknown) => {
      logger.info(`信令服务器断开: ${String(reason ?? "")}`);
      this.setConnectionState("disconnected");
      this.stats.reconnections++;
    });

    // 连接错误
    this.socket.on("error", (error?: unknown) => {
      this.stats.errors++;
      logger.error(
        "信令服务器错误",
        undefined,
        (error ?? new Error("unknown")) as Error,
      );
      this.emit("error", (error ?? new Error("unknown")) as Error);
    });
  }

  /**
   * 更新 RTC 配置
   */
  private updateRTCConfiguration(): void {
    if (this.peerConnection) {
      // 注意：RTCPeerConnection 创建后不能修改配置，需要重新创建
      logger.warn("RTCPeerConnection 已创建，无法更新配置");
    }
  }

  /**
   * 连接信令服务器
   *
   * 手动连接到信令服务器。如果设置了 `autoConnect: true`，则会在创建客户端时自动连接。
   * 若当前环境没有 RTCPeerConnection（如 Node/Bun 非浏览器），则立即置为 failed 并返回，避免后续
   * joinRoom 等操作挂起。若信令在约定时间内未连接成功，则超时置为 failed 并断开，避免无限等待。
   *
   * @example
   * ```typescript
   * client.connect();
   * ```
   */
  connect(): void {
    // 环境不具备 WebRTC 时立即失败，避免后续 joinRoom 等调用挂起（如 Bun/Node 无 RTCPeerConnection）
    const hasRTC = typeof (globalThis as { RTCPeerConnection?: unknown })
      .RTCPeerConnection !==
      "undefined";
    if (!hasRTC) {
      this.setConnectionState("failed");
      return;
    }

    this.socket.connect();

    // 信令连接超时：若在约定时间内未触发 "connect"，则置为 failed 并断开，避免无限挂起
    if (this.connectTimeoutId != null) {
      clearTimeout(this.connectTimeoutId);
    }
    this.connectTimeoutId = setTimeout(() => {
      this.connectTimeoutId = undefined;
      if (this.connectionState !== "connected") {
        this.socket.disconnect();
        this.setConnectionState("failed");
      }
    }, RTCClient.CONNECT_TIMEOUT_MS);
  }

  /**
   * 断开连接
   *
   * 关闭 PeerConnection、停止媒体流、离开房间并断开信令连接。
   *
   * @example
   * ```typescript
   * client.disconnect();
   * ```
   */
  disconnect(): void {
    // 清除信令连接超时定时器，避免断开后仍触发超时逻辑
    if (this.connectTimeoutId != null) {
      clearTimeout(this.connectTimeoutId);
      this.connectTimeoutId = undefined;
    }

    // 关闭所有 PeerConnection 并归还到连接池
    if (this.multiPeerMode) {
      // 多人房间模式：关闭所有对等体连接
      for (const [_userId, pc] of this.peerConnections.entries()) {
        this.connectionPool.release(pc);
      }
      this.peerConnections.clear();
      this.remoteStreams.clear();
    } else {
      // 点对点模式：关闭单个连接
      if (this.peerConnection) {
        this.connectionPool.release(this.peerConnection);
        this.peerConnection = undefined;
      }
    }

    // 停止本地媒体流
    if (this.localStream) {
      this.localStream.getTracks().forEach((track: any) => track.stop());
      this.localStream = undefined;
    }

    // 停止质量监控
    this.stopQualityMonitoring();

    // 离开房间
    if (this.roomId) {
      this.socket.emit("leave-room");
      this.roomId = undefined;
    }

    // 断开信令连接
    this.socket.disconnect();
    this.setConnectionState("closed");

    // 清理所有资源
    this.cleanup();

    // 清空连接池
    this.connectionPool.clear();
  }

  /**
   * 加入房间
   */
  async joinRoom(roomId: string, userId?: string): Promise<void> {
    this.roomId = roomId;
    this.userId = userId;

    // 发送加入房间请求
    this.socket.emit("join-room", { roomId, userId });

    // 初始化 PeerConnection
    this.initializePeerConnection();

    // 获取本地媒体流
    await this.getUserMedia();
  }

  /**
   * 离开房间
   *
   * 离开当前房间，关闭 PeerConnection 并停止媒体流。
   *
   * @example
   * ```typescript
   * client.leaveRoom();
   * ```
   */
  leaveRoom(): void {
    if (this.roomId) {
      this.socket.emit("leave-room");
      this.roomId = undefined;
    }

    // 断开 SFU 连接（如果使用 SFU 模式）
    if (this.currentArchitectureMode === "sfu" && this.sfuAdapter) {
      this.sfuAdapter.disconnect();
    }

    this.roomUserCount = 0;

    // 关闭 PeerConnection 并归还到连接池
    if (this.multiPeerMode) {
      // 多人房间模式：关闭所有对等体连接
      for (const [_userId, pc] of this.peerConnections.entries()) {
        this.connectionPool.release(pc);
      }
      this.peerConnections.clear();
      this.remoteStreams.clear();
    } else {
      // 点对点模式：关闭单个连接
      if (this.peerConnection) {
        this.connectionPool.release(this.peerConnection);
        this.peerConnection = undefined;
      }
    }

    // 停止本地媒体流
    if (this.localStream) {
      this.localStream.getTracks().forEach((track: any) => track.stop());
      this.localStream = undefined;
    }

    // 停止质量监控
    this.stopQualityMonitoring();

    // 清理所有资源
    this.cleanup();
  }

  /**
   * 检查并切换架构模式
   *
   * 当架构模式为 "auto" 时，根据房间人数自动切换：
   * - 房间人数 < meshToSFUThreshold：使用 Mesh 模式
   * - 房间人数 >= meshToSFUThreshold：切换到 SFU 模式
   *
   * @private
   */
  private checkAndSwitchArchitecture(): void {
    if (this.options.architectureMode !== "auto") {
      return;
    }

    const threshold = this.options.meshToSFUThreshold || 10;
    const shouldUseSFU = this.roomUserCount >= threshold;

    if (shouldUseSFU && this.currentArchitectureMode === "mesh") {
      // 切换到 SFU 模式
      this.switchArchitecture("sfu");
    } else if (!shouldUseSFU && this.currentArchitectureMode === "sfu") {
      // 切换回 Mesh 模式
      this.switchArchitecture("mesh");
    }
  }

  /**
   * 切换架构模式
   *
   * 在 Mesh 和 SFU 模式之间切换，包括：
   * - 关闭当前模式的连接
   * - 初始化新模式的连接
   * - 通知信令服务器架构模式变化
   *
   * @private
   * @param mode - 目标架构模式
   */
  private async switchArchitecture(mode: ArchitectureMode): Promise<void> {
    if (mode === this.currentArchitectureMode) {
      return;
    }

    logger.info(
      `切换架构模式: ${this.currentArchitectureMode} -> ${mode}`,
    );

    // 关闭当前模式的连接
    if (this.currentArchitectureMode === "mesh") {
      // 关闭所有 Mesh 连接
      this.peerConnections.forEach((pc) => {
        pc.close();
      });
      this.peerConnections.clear();
      this.remoteStreams.clear();
      if (this.peerConnection) {
        this.peerConnection.close();
        this.peerConnection = undefined;
      }
    } else if (this.currentArchitectureMode === "sfu" && this.sfuAdapter) {
      // 断开 SFU 连接
      this.sfuAdapter.disconnect();
    }

    // 更新架构模式
    this.currentArchitectureMode = mode;

    // 通知信令服务器
    this.socket.emit("signaling", {
      type: "architecture-mode",
      architectureMode: mode,
      roomId: this.roomId,
    });

    // 初始化新模式的连接
    if (mode === "sfu" && this.sfuAdapter && this.roomId) {
      // 连接到 SFU 服务器
      await this.sfuAdapter.connect();
      // 如果已有本地流，发布到 SFU
      if (this.localStream) {
        await this.sfuAdapter.publish(this.localStream);
      }
      // 订阅房间内其他用户的流
      // 注意：这里需要从信令服务器获取房间用户列表
    } else if (mode === "mesh" && this.roomId) {
      // 重新初始化 Mesh 连接
      this.initializePeerConnection();
      // 为房间内其他用户创建连接
      // 注意：这里需要从信令服务器获取房间用户列表
    }
  }

  /**
   * 清理所有资源（防止内存泄漏）
   *
   * @private
   */
  private cleanup(): void {
    // 清理 ICE candidates
    this.iceCandidates.clear();

    // 清理定时器
    for (const timer of this.iceCandidateTimers.values()) {
      clearTimeout(timer);
    }
    this.iceCandidateTimers.clear();

    // 清理已处理的消息 ID
    this.processedSignalingIds.clear();

    // 清理事件监听器
    this.eventListeners.clear();
  }

  /**
   * 初始化 PeerConnection
   *
   * 创建或从连接池获取 RTCPeerConnection 实例，设置事件处理器，
   * 添加本地媒体流轨道，并启动网络质量监控（如果启用）。
   *
   * @private
   */
  private initializePeerConnection(): void {
    // 创建 RTC 配置
    const rtcConfig: RTCConfiguration = {
      iceServers: this.iceServers.length > 0
        ? this.iceServers
        : this.options.rtcConfiguration?.iceServers || [
          { urls: "stun:stun.l.google.com:19302" },
        ],
      ...this.options.rtcConfiguration,
    };

    // 从连接池获取或创建 PeerConnection
    this.peerConnection = this.connectionPool.acquire(
      rtcConfig,
    ) as RTCPeerConnection;

    // 设置事件处理器
    this.setupPeerConnectionHandlers();

    // 添加本地媒体流轨道
    if (this.localStream) {
      this.localStream.getTracks().forEach((track: any) => {
        if (this.peerConnection) {
          this.peerConnection.addTrack(track, this.localStream!);
        }
      });
    }

    // 启动网络质量监控（如果启用）
    if (this.options.enableQualityAdaptation !== false) {
      this.startQualityMonitoring();
    }
  }

  /**
   * 设置 PeerConnection 事件处理器
   *
   * 为 RTCPeerConnection 设置以下事件处理器：
   * - `onicecandidate`: 收集 ICE candidates（批量处理优化）
   * - `oniceconnectionstatechange`: 监听 ICE 连接状态变化
   * - `onconnectionstatechange`: 监听连接状态变化
   * - `ontrack`: 接收远程媒体流
   * - `ondatachannel`: 接收数据通道
   *
   * @private
   */
  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) return;

    // ICE 候选（优化：批量收集后发送）
    this.peerConnection.onicecandidate = (event: any) => {
      if (event.candidate) {
        // 点对点模式：批量收集后发送
        this.collectIceCandidate("default", event.candidate);
      }
    };

    // ICE 连接状态变化
    this.peerConnection.oniceconnectionstatechange = () => {
      if (this.peerConnection) {
        const state = this.peerConnection
          .iceConnectionState as ICEConnectionState;
        this.setICEConnectionState(state);
      }
    };

    // 连接状态变化
    this.peerConnection.onconnectionstatechange = () => {
      if (this.peerConnection) {
        const state = this.peerConnection.connectionState as ConnectionState;
        this.setConnectionState(state);
      }
    };

    // 接收远程媒体流
    this.peerConnection.ontrack = (event: any) => {
      if (event.streams && event.streams.length > 0) {
        this.remoteStream = event.streams[0];
        this.emit("stream", this.remoteStream);
      } else if (event.track) {
        // 如果没有 stream，创建一个新的 stream
        this.remoteStream = new MediaStreamConstructor([event.track]);
        this.emit("stream", this.remoteStream);
      }
    };

    // 数据通道
    this.peerConnection.ondatachannel = (event: any) => {
      this.emit("data-channel", event.channel);
    };
  }

  /**
   * 获取用户媒体（摄像头和麦克风）
   *
   * @param constraints - 媒体流约束，如果不提供则使用配置中的约束
   * @returns 返回 MediaStream 对象
   *
   * @example
   * ```typescript
   * // 获取音频和视频
   * const stream = await client.getUserMedia({ audio: true, video: true });
   *
   * // 只获取音频
   * const stream = await client.getUserMedia({ audio: true, video: false });
   *
   * // 自定义视频质量
   * const stream = await client.getUserMedia({
   *   audio: true,
   *   video: { width: 1280, height: 720, frameRate: 30 }
   * });
   * ```
   */
  async getUserMedia(
    constraints?: MediaStreamConstraints,
  ): Promise<MediaStream> {
    const mediaConstraints: MediaStreamConstraints = constraints ||
      this.options.mediaConstraints || {
      audio: true,
      video: true,
    };

    try {
      this.localStream = await (navigator as any).mediaDevices.getUserMedia(
        mediaConstraints,
      );

      // 将本地流添加到 PeerConnection
      if (this.peerConnection) {
        this.localStream.getTracks().forEach((track: any) => {
          this.peerConnection!.addTrack(track, this.localStream!);
        });
      }

      this.emit("stream", this.localStream);
      return this.localStream;
    } catch (error) {
      logger.error("获取用户媒体失败", undefined, error);
      this.emit("error", error);
      throw error;
    }
  }

  /**
   * 获取屏幕共享流
   *
   * @param constraints - 屏幕共享约束
   * @returns 返回 MediaStream 对象
   *
   * @example
   * ```typescript
   * const stream = await client.getDisplayMedia({ video: true, audio: true });
   * ```
   */
  async getDisplayMedia(
    constraints?: MediaStreamConstraints,
  ): Promise<MediaStream> {
    const mediaConstraints: MediaStreamConstraints = constraints || {
      video: true,
      audio: true,
    };

    try {
      const stream = await navigator.mediaDevices!.getDisplayMedia(
        mediaConstraints,
      );

      // 如果已有本地流，停止旧的视频轨道
      if (this.localStream) {
        this.localStream.getVideoTracks().forEach((track: any) => track.stop());
        // 添加新的视频轨道
        stream.getVideoTracks().forEach((track: any) => {
          this.localStream!.addTrack(track);
          if (this.peerConnection) {
            this.peerConnection.addTrack(track, this.localStream!);
          }
        });
      } else {
        this.localStream = stream;
        // 将流添加到 PeerConnection
        if (this.peerConnection) {
          this.localStream.getTracks().forEach((track: any) => {
            this.peerConnection!.addTrack(track, this.localStream!);
          });
        }
      }

      this.emit("stream", this.localStream);
      return this.localStream;
    } catch (error) {
      this.stats.errors++;
      logger.error("获取屏幕共享失败", undefined, error);
      this.emit("error", error);
      throw error;
    }
  }

  /**
   * 创建数据通道
   *
   * @param label - 数据通道标签
   * @param options - 数据通道选项
   * @returns 返回 RTCDataChannel 对象
   *
   * @example
   * ```typescript
   * const channel = client.createDataChannel("chat");
   * channel.onopen = () => {
   *   channel.send("Hello!");
   * };
   * channel.onmessage = (event) => {
   *   console.log("收到消息:", event.data);
   * };
   * ```
   */
  createDataChannel(
    label: string,
    options?: RTCDataChannelInit,
  ): RTCDataChannel | null {
    if (!this.peerConnection) {
      logger.warn("PeerConnection 未初始化");
      return null;
    }

    try {
      const channel = this.peerConnection.createDataChannel(label, options);
      return channel;
    } catch (error) {
      this.stats.errors++;
      logger.error("创建数据通道失败", undefined, error);
      this.emit("error", error);
      return null;
    }
  }

  /**
   * 创建 Offer
   *
   * 创建 WebRTC Offer 并发送给对等体。如果创建失败，会在 1 秒后自动重试。
   *
   * @private
   * @throws 如果 PeerConnection 未初始化或创建 Offer 失败，会触发错误事件
   */
  private async createOffer(): Promise<void> {
    if (!this.peerConnection) {
      logger.warn("PeerConnection 未初始化");
      return;
    }

    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);

      // 发送 offer
      this.sendSignaling({
        type: "offer",
        sdp: offer,
      });
    } catch (error) {
      this.stats.errors++;
      logger.error("创建 Offer 失败", undefined, error);
      this.emit("error", error);

      // 重试机制：如果失败，等待一段时间后重试
      if (
        this.peerConnection && this.peerConnection.signalingState === "stable"
      ) {
        setTimeout(() => {
          if (
            this.peerConnection &&
            this.peerConnection.signalingState === "stable"
          ) {
            this.createOffer().catch((err) => {
              logger.error("Offer 重试失败", undefined, err);
            });
          }
        }, 1000);
      }
    }
  }

  /**
   * 处理信令消息
   *
   * 处理从信令服务器接收到的信令消息，包括：
   * - 消息去重（使用消息 ID）
   * - 根据模式（点对点/多人房间）路由到对应的 PeerConnection
   * - 调用 `handleSignalingForPeer()` 处理具体的信令消息
   *
   * @private
   * @param message - 信令消息对象
   */
  private async handleSignaling(message: SignalingMessage): Promise<void> {
    try {
      // SFU 相关消息由 SFU 适配器处理
      if (
        this.currentArchitectureMode === "sfu" &&
        this.sfuAdapter &&
        (message.type.startsWith("sfu-") ||
          message.type === "answer" ||
          message.type === "ice-candidate")
      ) {
        this.sfuAdapter.handleSignaling(message);
        return;
      }

      // 信令消息去重
      const messageId = this.getMessageId(message);
      if (this.processedSignalingIds.has(messageId)) {
        logger.debug(`重复消息已忽略: ${messageId}`);
        return;
      }
      this.processedSignalingIds.add(messageId);
      this.stats.messagesReceived++;

      // 定期清理旧的消息 ID（避免内存泄漏）
      if (this.processedSignalingIds.size > 1000) {
        this.processedSignalingIds.clear();
      }

      // 多人房间模式：根据 message.from 找到对应的 PeerConnection
      if (this.multiPeerMode && message.from) {
        const pc = this.peerConnections.get(message.from);
        if (!pc) {
          logger.warn(
            `未找到用户 ${message.from} 的 PeerConnection`,
          );
          return;
        }
        await this.handleSignalingForPeer(pc, message);
      } else {
        // 点对点模式：使用单个 PeerConnection
        if (!this.peerConnection) {
          logger.warn("PeerConnection 未初始化");
          return;
        }
        await this.handleSignalingForPeer(this.peerConnection, message);
      }
    } catch (error) {
      this.stats.errors++;
      logger.error("处理信令消息失败", undefined, error);
      this.emit("error", error);
    }
  }

  /**
   * 生成信令消息的唯一 ID（用于去重）
   *
   * @private
   * @param message - 信令消息
   * @returns 消息唯一 ID
   */
  private getMessageId(message: SignalingMessage): string {
    // 使用消息类型、发送者、SDP 或 candidate 生成唯一 ID
    const sdpHash = message.sdp?.sdp ? message.sdp.sdp.substring(0, 50) : "";
    const candidateHash = message.candidate?.candidate
      ? message.candidate.candidate.substring(0, 50)
      : "";
    return `${message.type}-${message.from || ""}-${sdpHash}${candidateHash}`;
  }

  /**
   * 为指定的 PeerConnection 处理信令消息
   *
   * 根据消息类型处理不同的信令消息：
   * - `offer`: 设置远程描述并创建 answer
   * - `answer`: 设置远程描述
   * - `ice-candidate`: 添加 ICE candidate
   * - `error`: 触发错误事件
   *
   * @private
   * @param pc - RTCPeerConnection 实例
   * @param message - 信令消息对象
   */
  private async handleSignalingForPeer(
    pc: RTCPeerConnection,
    message: SignalingMessage,
  ): Promise<void> {
    switch (message.type) {
      case "offer":
        if (message.sdp) {
          await pc.setRemoteDescription(
            new RTCSessionDescriptionConstructor(message.sdp),
          );
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);

          // 发送 answer
          this.sendSignaling({
            type: "answer",
            sdp: answer,
            to: message.from, // 回复给发送者
          });
        }
        break;

      case "answer":
        if (message.sdp) {
          try {
            await pc.setRemoteDescription(
              new RTCSessionDescriptionConstructor(message.sdp),
            );
          } catch (error) {
            this.stats.errors++;
            logger.error("处理 Answer 失败", undefined, error);
            this.emit("error", error);
          }
        }
        break;

      case "ice-candidate":
        if (message.candidate) {
          try {
            await pc.addIceCandidate(
              new RTCIceCandidateConstructor(message.candidate),
            );
          } catch (error) {
            // ICE candidate 错误通常可以忽略（可能是过期的 candidate）
            logger.debug(
              "添加 ICE candidate 失败（可忽略）",
              undefined,
              error,
            );
          }
        }
        break;

      case "error":
        logger.error("信令错误", { error: message.error });
        this.emit("error", new Error(message.error || "未知错误"));
        break;
    }
  }

  /**
   * 发送信令消息
   *
   * 通过 Socket.IO 发送信令消息到信令服务器。自动添加房间 ID 和用户 ID。
   *
   * @private
   * @param message - 信令消息对象
   */
  private sendSignaling(message: SignalingMessage): void {
    if (this.roomId) {
      message.roomId = this.roomId;
    }
    if (this.userId) {
      message.from = this.userId;
    }
    this.socket.emit("signaling", message);
    this.stats.messagesSent++;
  }

  /**
   * 设置连接状态
   *
   * 更新内部连接状态，并在状态改变时触发 `connection-state-change` 事件。
   *
   * @private
   * @param state - 新的连接状态
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.emit("connection-state-change", state);
    }
  }

  /**
   * 设置 ICE 连接状态
   *
   * 更新内部 ICE 连接状态，并在状态改变时触发 `ice-connection-state-change` 事件。
   *
   * @private
   * @param state - 新的 ICE 连接状态
   */
  private setICEConnectionState(state: ICEConnectionState): void {
    if (this.iceConnectionState !== state) {
      this.iceConnectionState = state;
      this.emit("ice-connection-state-change", state);
    }
  }

  /**
   * 监听事件
   *
   * @param event - 事件名称
   * @param callback - 事件回调函数
   *
   * @example
   * ```typescript
   * client.on("stream", (stream) => {
   *   videoElement.srcObject = stream;
   * });
   *
   * client.on("connection-state-change", (state) => {
   *   console.log("连接状态:", state);
   * });
   * ```
   */
  on(event: RTCEvent, callback: EventCallback): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.push(callback);
    this.eventListeners.set(event, listeners);
  }

  /**
   * 移除事件监听器
   *
   * @param event - 事件名称
   * @param callback - 要移除的回调函数（可选，不提供则移除该事件的所有监听器）
   *
   * @example
   * ```typescript
   * // 移除特定回调
   * client.off("stream", myCallback);
   *
   * // 移除事件的所有监听器
   * client.off("stream");
   * ```
   */
  off(event: RTCEvent, callback?: EventCallback): void {
    if (!callback) {
      this.eventListeners.delete(event);
    } else {
      const listeners = this.eventListeners.get(event) || [];
      const filtered = listeners.filter((cb) => cb !== callback);
      if (filtered.length === 0) {
        this.eventListeners.delete(event);
      } else {
        this.eventListeners.set(event, filtered);
      }
    }
  }

  /**
   * 触发事件
   */
  /**
   * 触发事件
   *
   * 触发指定事件，调用所有注册的监听器。
   *
   * @private
   * @param event - 事件名称
   * @param data - 事件数据
   */
  private emit(event: RTCEvent, data: any): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        logger.error(`事件处理器错误 (${event})`, undefined, error);
      }
    });
  }

  /**
   * 获取本地媒体流
   *
   * @returns 本地媒体流，如果未获取则返回 undefined
   */
  getLocalStream(): MediaStream | undefined {
    return this.localStream;
  }

  /**
   * 获取远程媒体流
   *
   * @returns 远程媒体流，如果未收到则返回 undefined
   */
  getRemoteStream(): MediaStream | undefined {
    return this.remoteStream;
  }

  /**
   * 获取连接状态
   *
   * @returns 当前连接状态
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * 获取 ICE 连接状态
   *
   * @returns 当前 ICE 连接状态
   */
  getICEConnectionState(): ICEConnectionState {
    return this.iceConnectionState;
  }

  /**
   * 获取连接统计信息
   *
   * @returns 连接统计信息
   *
   * @example
   * ```typescript
   * const stats = client.getStats();
   * console.log(`已发送 ${stats.messagesSent} 条消息`);
   * console.log(`已接收 ${stats.messagesReceived} 条消息`);
   * console.log(`错误次数: ${stats.errors}`);
   * ```
   */
  getStats(): {
    messagesSent: number;
    messagesReceived: number;
    errors: number;
    reconnections: number;
  } {
    return { ...this.stats };
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
      reconnections: 0,
    };
  }

  /**
   * 获取连接池统计信息
   *
   * @returns 连接池统计信息
   *
   * @example
   * ```typescript
   * const poolStats = client.getConnectionPoolStats();
   * console.log(`已创建 ${poolStats.created} 个连接`);
   * console.log(`当前活跃 ${poolStats.active} 个连接`);
   * ```
   */
  getConnectionPoolStats(): {
    created: number;
    released: number;
    active: number;
    pendingClose: number;
    configCacheSize: number;
  } {
    return this.connectionPool.getStats();
  }

  /**
   * 为指定用户创建 PeerConnection（多人房间模式）
   *
   * @private
   * @param userId - 目标用户 ID
   */
  private createPeerConnectionForUser(userId: string): void {
    if (this.peerConnections.has(userId)) {
      logger.warn(`用户 ${userId} 的连接已存在`);
      return;
    }

    // 创建 RTC 配置
    const rtcConfig: RTCConfiguration = {
      iceServers: this.iceServers.length > 0
        ? this.iceServers
        : this.options.rtcConfiguration?.iceServers || [
          { urls: "stun:stun.l.google.com:19302" },
        ],
      ...this.options.rtcConfiguration,
    };

    // 从连接池获取或创建 PeerConnection
    const pc = this.connectionPool.acquire(rtcConfig);
    this.peerConnections.set(userId, pc);

    // 设置事件处理器
    this.setupPeerConnectionHandlersForUser(userId, pc);

    // 添加本地媒体流轨道
    if (this.localStream) {
      this.localStream.getTracks().forEach((track: any) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // 创建 offer
    this.createOfferForUser(userId, pc);
  }

  /**
   * 为指定用户的 PeerConnection 设置事件处理器
   *
   * @private
   * @param userId - 用户 ID
   * @param pc - RTCPeerConnection 实例
   */
  private setupPeerConnectionHandlersForUser(
    userId: string,
    pc: RTCPeerConnection,
  ): void {
    // ICE 候选（批量收集）
    pc.onicecandidate = (event: any) => {
      if (event.candidate) {
        this.collectIceCandidate(userId, event.candidate);
      }
    };

    // ICE 连接状态变化
    pc.oniceconnectionstatechange = () => {
      const state = pc.iceConnectionState as ICEConnectionState;
      logger.info(`用户 ${userId} ICE 连接状态: ${state}`);
    };

    // 连接状态变化
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState as ConnectionState;
      logger.info(`用户 ${userId} 连接状态: ${state}`);
    };

    // 接收远程媒体流
    pc.ontrack = (event: any) => {
      if (event.streams && event.streams.length > 0) {
        const stream = event.streams[0];
        this.remoteStreams.set(userId, stream);
        this.emit("stream", { userId, stream });
      } else if (event.track) {
        const stream = new MediaStreamConstructor([event.track]);
        this.remoteStreams.set(userId, stream);
        this.emit("stream", { userId, stream });
      }
    };

    // 数据通道
    pc.ondatachannel = (event: any) => {
      this.emit("data-channel", { userId, channel: event.channel });
    };
  }

  /**
   * 为指定用户创建 Offer
   *
   * @private
   * @param userId - 目标用户 ID
   * @param pc - RTCPeerConnection 实例
   */
  private async createOfferForUser(
    userId: string,
    pc: RTCPeerConnection,
  ): Promise<void> {
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // 发送 offer（指定接收者）
      this.sendSignaling({
        type: "offer",
        sdp: offer,
        to: userId,
      });
    } catch (error) {
      logger.error(`为用户 ${userId} 创建 Offer 失败`, undefined, error);
      this.emit("error", error);
    }
  }

  /**
   * 移除指定用户的 PeerConnection
   *
   * @private
   * @param userId - 用户 ID
   */
  private removePeerConnectionForUser(userId: string): void {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(userId);
      this.remoteStreams.delete(userId);
      this.iceCandidates.delete(userId);

      // 清理定时器
      const timer = this.iceCandidateTimers.get(userId);
      if (timer) {
        clearTimeout(timer);
        this.iceCandidateTimers.delete(userId);
      }
    }
  }

  /**
   * 收集 ICE candidate（批量处理优化）
   *
   * @private
   * @param userId - 用户 ID（多人房间模式）或 "default"（点对点模式）
   * @param candidate - ICE candidate
   */
  private collectIceCandidate(
    userId: string,
    candidate: RTCIceCandidate,
  ): void {
    const key = userId;
    if (!this.iceCandidates.has(key)) {
      this.iceCandidates.set(key, []);
    }
    this.iceCandidates.get(key)!.push(candidate);

    // 延迟发送，批量处理
    this.scheduleIceCandidateSend(key);
  }

  /**
   * 安排 ICE candidates 的批量发送
   *
   * @private
   * @param userId - 用户 ID
   */
  private scheduleIceCandidateSend(userId: string): void {
    if (this.iceCandidateTimers.has(userId)) {
      return; // 已有定时器，等待批量发送
    }

    const timer = setTimeout(() => {
      const candidates = this.iceCandidates.get(userId);
      if (candidates && candidates.length > 0) {
        // 批量发送 candidates
        for (const candidate of candidates) {
          this.sendSignaling({
            type: "ice-candidate",
            candidate,
            to: userId !== "default" ? userId : undefined,
          });
        }
        this.iceCandidates.delete(userId);
      }
      this.iceCandidateTimers.delete(userId);
    }, 100); // 100ms 内收集的 candidates 批量发送

    this.iceCandidateTimers.set(userId, timer);
  }

  /**
   * 启动网络质量监控
   *
   * @private
   */
  private startQualityMonitoring(): void {
    if (this.qualityMonitorTimer) {
      return; // 已启动
    }

    // 每 5 秒检查一次网络质量
    this.qualityMonitorTimer = setInterval(() => {
      this.checkNetworkQuality();
    }, 5000);
  }

  /**
   * 停止网络质量监控
   *
   * 清除网络质量监控定时器，停止定期检查网络质量。
   *
   * @private
   */
  private stopQualityMonitoring(): void {
    if (this.qualityMonitorTimer) {
      clearInterval(this.qualityMonitorTimer);
      this.qualityMonitorTimer = undefined;
    }
  }

  /**
   * 检查网络质量并调整媒体流质量
   *
   * 通过 RTCPeerConnection 的 `getStats()` 方法获取网络统计信息，
   * 分析带宽、丢包率、RTT 等指标，然后调用 `adjustMediaQuality()` 调整媒体流质量。
   *
   * @private
   * @returns Promise，在检查完成后解析
   */
  private async checkNetworkQuality(): Promise<void> {
    const pc = this.peerConnection ||
      (this.multiPeerMode && this.peerConnections.size > 0
        ? Array.from(this.peerConnections.values())[0]
        : null);

    if (!pc) {
      return;
    }

    try {
      const stats = await pc.getStats();
      let totalBytesReceived = 0;
      let totalPacketsLost = 0;
      let totalPackets = 0;
      let rtt = 0;
      const timestamp = Date.now();

      // 分析统计信息
      for (const report of stats.values()) {
        if (report.type === "inbound-rtp") {
          totalBytesReceived += (report.bytesReceived as number) || 0;
          totalPacketsLost += (report.packetsLost as number) || 0;
          totalPackets += (report.packetsReceived as number) || 0;
        }
        if (report.type === "candidate-pair" && (report.selected as boolean)) {
          rtt = (report.currentRoundTripTime as number) || 0;
        }
      }

      // 计算带宽（基于最近的数据）
      const timeDiff = timestamp - this.networkStats.lastUpdate;
      if (timeDiff > 0 && this.networkStats.lastUpdate > 0) {
        const bytesDiff = totalBytesReceived -
          (this.networkStats.bandwidth * (this.networkStats.lastUpdate / 1000));
        const bandwidth = (bytesDiff * 8) / (timeDiff / 1000); // bps
        this.networkStats.bandwidth = bandwidth;
      }

      // 计算丢包率
      const packetLoss = totalPackets > 0
        ? (totalPacketsLost / totalPackets) * 100
        : 0;
      this.networkStats.packetLoss = packetLoss;
      this.networkStats.rtt = rtt;
      this.networkStats.lastUpdate = timestamp;

      // 根据网络状况调整质量
      this.adjustMediaQuality();
    } catch (error) {
      logger.debug("获取网络统计信息失败", undefined, error);
    }
  }

  /**
   * 根据网络状况调整媒体流质量
   *
   * 根据当前的网络质量统计（带宽、丢包率、RTT）确定目标质量等级：
   * - `low`: 带宽 < 500 Kbps 或丢包率 > 5% 或 RTT > 300ms
   * - `medium`: 带宽 < 2 Mbps 或丢包率 > 2% 或 RTT > 150ms
   * - `high`: 其他情况
   *
   * 如果质量等级改变，调用 `applyQualitySettings()` 应用新的质量设置。
   *
   * @private
   */
  private adjustMediaQuality(): void {
    if (!this.localStream) {
      return;
    }

    const { bandwidth, packetLoss, rtt } = this.networkStats;

    // 根据网络状况确定质量等级
    let targetQuality: "low" | "medium" | "high" = "high";

    // 带宽判断（bps）
    if (bandwidth < 500000) { // < 500 Kbps
      targetQuality = "low";
    } else if (bandwidth < 2000000) { // < 2 Mbps
      targetQuality = "medium";
    }

    // 丢包率判断
    if (packetLoss > 5) {
      targetQuality = "low";
    } else if (packetLoss > 2) {
      targetQuality = targetQuality === "high" ? "medium" : "low";
    }

    // RTT 判断（ms）
    if (rtt > 300) {
      targetQuality = "low";
    } else if (rtt > 150) {
      targetQuality = targetQuality === "high" ? "medium" : "low";
    }

    // 如果质量等级改变，调整媒体流
    if (targetQuality !== this.currentQuality) {
      this.currentQuality = targetQuality;
      this.applyQualitySettings(targetQuality);
    }
  }

  /**
   * 应用质量设置到媒体流
   *
   * 根据质量等级应用相应的视频约束：
   * - `low`: 320x240@15fps
   * - `medium`: 640x480@24fps
   * - `high`: 1280x720@30fps
   *
   * @private
   * @param quality - 质量等级（low、medium、high）
   */
  private applyQualitySettings(quality: "low" | "medium" | "high"): void {
    if (!this.localStream) {
      return;
    }

    const videoTracks = this.localStream.getVideoTracks();
    if (videoTracks.length === 0) {
      return;
    }

    // 定义不同质量等级的约束
    const qualityConstraints: Record<
      "low" | "medium" | "high",
      { width: number; height: number; frameRate: number }
    > = {
      low: { width: 320, height: 240, frameRate: 15 },
      medium: { width: 640, height: 480, frameRate: 24 },
      high: { width: 1280, height: 720, frameRate: 30 },
    };

    const constraints = qualityConstraints[quality];

    // 应用约束到视频轨道
    for (const track of videoTracks) {
      track.applyConstraints({
        width: { ideal: constraints.width },
        height: { ideal: constraints.height },
        frameRate: { ideal: constraints.frameRate },
      }).catch((error: unknown) => {
        logger.debug("应用质量设置失败", undefined, error as Error);
      });
    }

    logger.info(
      `媒体质量已调整为: ${quality} (${constraints.width}x${constraints.height}@${constraints.frameRate}fps)`,
    );
  }

  /**
   * 获取网络质量统计信息
   *
   * @returns 网络质量统计信息
   */
  getNetworkStats(): {
    bandwidth: number;
    packetLoss: number;
    rtt: number;
    quality: "low" | "medium" | "high";
  } {
    return {
      ...this.networkStats,
      quality: this.currentQuality,
    };
  }
}

/**
 * RTCPeerConnection 连接池
 *
 * 优化说明：
 * RTCPeerConnection 一旦关闭就不能再使用，无法直接复用。
 * 但我们可以通过以下方式优化：
 * 1. 缓存配置对象，避免重复创建
 * 2. 统一管理连接生命周期，确保正确清理
 * 3. 统计连接使用情况，优化资源分配
 * 4. 延迟关闭连接，减少频繁创建/销毁
 */
class RTCPeerConnectionPool {
  private maxSize: number;
  private activeConnections: Set<RTCPeerConnection> = new Set();
  /** 配置缓存（相同配置复用） */
  private configCache: Map<string, RTCConfiguration> = new Map();
  /** 连接统计 */
  private stats: {
    created: number;
    released: number;
    active: number;
  } = {
    created: 0,
    released: 0,
    active: 0,
  };
  /** 待关闭的连接队列（延迟关闭，避免频繁创建/销毁） */
  private pendingClose: Map<RTCPeerConnection, number> = new Map();
  /** 延迟关闭的时间（毫秒） */
  private closeDelay: number = 1000;

  constructor(options: { maxSize?: number; closeDelay?: number } = {}) {
    this.maxSize = options.maxSize || 5;
    this.closeDelay = options.closeDelay || 1000;
  }

  /**
   * 从连接池获取或创建 RTCPeerConnection
   *
   * 优化：缓存配置对象，相同配置复用配置对象
   *
   * @param config - RTC 配置
   * @returns RTCPeerConnection 实例
   */
  acquire(config: RTCConfiguration): RTCPeerConnection {
    // 生成配置的哈希键（用于缓存）
    const configKey = this.getConfigKey(config);

    // 尝试从缓存获取配置对象（避免重复创建相同配置）
    let cachedConfig = this.configCache.get(configKey);
    if (!cachedConfig) {
      // 深拷贝配置，避免外部修改影响缓存
      cachedConfig = this.deepCloneConfig(config);
      this.configCache.set(configKey, cachedConfig);

      // 限制缓存大小，避免内存泄漏
      if (this.configCache.size > 10) {
        const firstKey = this.configCache.keys().next().value;
        if (firstKey) {
          this.configCache.delete(firstKey);
        }
      }
    }

    // 创建新连接（RTCPeerConnection 无法复用，必须创建新的）
    // 在 Deno 测试环境中，RTCPeerConnection 可能不可用
    const RTCPeerConnectionCtor = (globalThis as any).RTCPeerConnection as
      | {
        new (configuration?: RTCConfiguration): RTCPeerConnection;
      }
      | undefined;
    if (!RTCPeerConnectionCtor) {
      throw new Error(
        "RTCPeerConnection is not available in this environment. This library requires a browser environment.",
      );
    }
    const pc = new RTCPeerConnectionCtor(cachedConfig);

    this.activeConnections.add(pc);
    this.stats.created++;
    this.stats.active = this.activeConnections.size;

    return pc;
  }

  /**
   * 归还 RTCPeerConnection 到连接池
   *
   * 优化：延迟关闭连接，如果短时间内需要新连接可以复用
   *
   * @param pc - RTCPeerConnection 实例
   */
  release(pc: RTCPeerConnection): void {
    if (!this.activeConnections.has(pc)) {
      return; // 不属于此池
    }

    this.activeConnections.delete(pc);
    this.stats.released++;
    this.stats.active = this.activeConnections.size;

    // 延迟关闭连接（优化：如果短时间内需要新连接，可以避免重新创建）
    // 注意：由于 RTCPeerConnection 的特性，即使延迟关闭也无法真正复用
    // 但延迟关闭可以减少频繁的创建/销毁操作
    const closeTimer = setTimeout(() => {
      try {
        pc.close();
      } catch {
        // 忽略关闭错误
      }
      this.pendingClose.delete(pc);
    }, this.closeDelay);

    this.pendingClose.set(pc, closeTimer);
  }

  /**
   * 立即关闭连接（不延迟）
   *
   * 取消延迟关闭定时器（如果存在），并立即关闭 RTCPeerConnection。
   * 用于需要立即释放资源的场景。
   *
   * @param pc - RTCPeerConnection 实例
   */
  releaseImmediate(pc: RTCPeerConnection): void {
    // 取消延迟关闭
    const timer = this.pendingClose.get(pc);
    if (timer) {
      clearTimeout(timer);
      this.pendingClose.delete(pc);
    }

    // 立即关闭
    try {
      pc.close();
    } catch {
      // 忽略关闭错误
    }

    this.activeConnections.delete(pc);
    this.stats.released++;
    this.stats.active = this.activeConnections.size;
  }

  /**
   * 清空连接池
   */
  clear(): void {
    // 立即关闭所有待关闭的连接
    for (const [pc, timer] of this.pendingClose.entries()) {
      clearTimeout(timer);
      try {
        pc.close();
      } catch {
        // 忽略关闭错误
      }
    }
    this.pendingClose.clear();

    // 关闭所有活动连接
    for (const pc of this.activeConnections) {
      try {
        pc.close();
      } catch {
        // 忽略关闭错误
      }
    }

    this.activeConnections.clear();
    this.configCache.clear();
    this.stats = {
      created: 0,
      released: 0,
      active: 0,
    };
  }

  /**
   * 获取连接池统计信息
   *
   * 返回连接池的统计信息，包括：
   * - `created`: 已创建的连接数
   * - `released`: 已释放的连接数
   * - `active`: 当前活跃的连接数
   * - `pendingClose`: 待关闭的连接数
   * - `configCacheSize`: 配置缓存大小
   *
   * @returns 连接池统计信息对象
   */
  getStats(): {
    created: number;
    released: number;
    active: number;
    pendingClose: number;
    configCacheSize: number;
  } {
    return {
      ...this.stats,
      pendingClose: this.pendingClose.size,
      configCacheSize: this.configCache.size,
    };
  }

  /**
   * 生成配置的哈希键
   *
   * @private
   * @param config - RTC 配置
   * @returns 配置键
   */
  private getConfigKey(config: RTCConfiguration): string {
    // 简单哈希：将配置序列化为字符串
    const iceServers = config.iceServers
      ? JSON.stringify(config.iceServers)
      : "";
    return `${config.iceTransportPolicy || ""}-${
      config.bundlePolicy || ""
    }-${iceServers}`;
  }

  /**
   * 深拷贝配置对象
   *
   * 深拷贝 RTC 配置对象，包括 ICE 服务器列表，避免外部修改影响缓存。
   *
   * @private
   * @param config - 原始 RTC 配置对象
   * @returns 深拷贝的 RTC 配置对象
   */
  private deepCloneConfig(config: RTCConfiguration): RTCConfiguration {
    return {
      ...config,
      iceServers: config.iceServers
        ? config.iceServers.map((server) => ({ ...server }))
        : undefined,
    };
  }
}

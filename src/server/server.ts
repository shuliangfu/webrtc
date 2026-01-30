/**
 * @module @dreamer/webrtc/server/server
 *
 * @fileoverview WebRTC 信令服务器
 * 基于 Socket.IO 实现 WebRTC 信令服务器，用于 WebRTC 连接建立和协商
 */

import { createLogger } from "@dreamer/logger";
import type { SocketIOSocket } from "@dreamer/socket-io";
import { Server as SocketIOServer } from "@dreamer/socket-io";
import type {
  ICEServer,
  RoomInfo,
  SignalingMessage,
  SignalingServerOptions,
  UserInfo,
} from "../types.ts";
import type { ServiceContainer } from "@dreamer/service";

/**
 * WebRTC 信令服务器
 *
 * 基于 Socket.IO 实现，用于 WebRTC 连接建立和协商。
 * 负责处理房间管理、用户管理、信令消息转发等功能。
 *
 * @example
 * ```typescript
 * const server = new SignalingServer({
 *   port: 3000,
 *   stunServers: [{ urls: "stun:stun.l.google.com:19302" }],
 * });
 *
 * await server.listen();
 * ```
 */
export class SignalingServer {
  /** Socket.IO 服务器实例 */
  private io: SocketIOServer;
  /** 日志器实例 */
  private logger = createLogger({
    level: "info",
    context: { module: "SignalingServer" },
  });
  /** 房间映射（roomId -> RoomInfo） */
  private rooms: Map<string, RoomInfo> = new Map();
  /** 用户映射（userId -> UserInfo） */
  private users: Map<string, UserInfo> = new Map();
  /** Socket 到用户的映射（socketId -> userId） */
  private socketToUser: Map<string, string> = new Map();
  /** 用户到 Socket 的映射（userId -> socketId），用于快速查找 */
  private userToSocket: Map<string, string> = new Map();
  /** STUN 服务器列表 */
  private stunServers: ICEServer[] = [];
  /** TURN 服务器列表 */
  private turnServers: ICEServer[] = [];
  /** 信令消息统计 */
  private stats: {
    messagesReceived: number;
    messagesSent: number;
    messagesDelayed: number;
    averageLatency: number;
    lastMessageTime: number;
  } = {
    messagesReceived: 0,
    messagesSent: 0,
    messagesDelayed: 0,
    averageLatency: 0,
    lastMessageTime: 0,
  };
  /** 消息延迟记录（用于计算平均延迟） */
  private messageLatencies: number[] = [];
  /** 批量消息队列（用于批量处理信令消息） */
  private messageQueue: Map<string, SignalingMessage[]> = new Map();
  /** 批量消息定时器 */
  private messageQueueTimers: Map<string, number> = new Map();
  /** 批量处理延迟（毫秒） */
  private batchDelay: number = 50;

  /**
   * 创建信令服务器实例
   *
   * @param options - 服务器配置选项
   * @param options.port - 端口号（默认：3000）
   * @param options.host - 主机地址（默认："0.0.0.0"）
   * @param options.path - Socket.IO 路径（默认："/webrtc-signaling"）
   * @param options.cors - CORS 配置
   * @param options.stunServers - STUN 服务器列表
   * @param options.turnServers - TURN 服务器列表
   */
  constructor(options: SignalingServerOptions = {}) {
    // 创建 Socket.IO 服务器
    // 使用默认路径 /socket.io/ 以兼容 Socket.IO 客户端
    this.io = new SocketIOServer({
      port: options.port || 3000,
      host: options.host || "0.0.0.0",
      path: options.path || "/socket.io/",
      cors: options.cors,
    });

    // 配置 STUN/TURN 服务器
    if (options.stunServers) {
      this.stunServers = options.stunServers;
    } else {
      // 默认 STUN 服务器
      this.stunServers = [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ];
    }

    if (options.turnServers) {
      this.turnServers = options.turnServers;
    }

    // 设置连接处理
    this.setupConnectionHandlers();
  }

  /**
   * 设置连接处理器
   *
   * 为 Socket.IO 服务器设置连接事件处理器，包括：
   * - `join-room`: 处理用户加入房间
   * - `leave-room`: 处理用户离开房间
   * - `signaling`: 处理信令消息（offer、answer、ice-candidate）
   * - `disconnect`: 处理断开连接
   * - 自动发送 ICE 服务器配置给新连接的客户端
   *
   * @private
   */
  private setupConnectionHandlers(): void {
    this.io.on("connection", (socket: SocketIOSocket) => {
      this.logger.info(`[SignalingServer] 新连接: ${socket.id}`);

      // 处理加入房间
      socket.on(
        "join-room",
        (data: { roomId: string; userId?: string }) => {
          this.handleJoinRoom(socket, data.roomId, data.userId);
        },
      );

      // 处理离开房间
      socket.on("leave-room", () => {
        this.handleLeaveRoom(socket);
      });

      // 处理信令消息（offer、answer、ice-candidate）
      socket.on("signaling", (message: SignalingMessage) => {
        this.handleSignaling(socket, message);
      });

      // 处理断开连接
      socket.on("disconnect", (reason: string) => {
        this.handleDisconnect(socket, reason);
      });

      // 发送 ICE 服务器配置
      socket.emit("ice-servers", {
        stunServers: this.stunServers,
        turnServers: this.turnServers,
      });
    });
  }

  /**
   * 处理加入房间
   *
   * 处理用户加入房间的请求，包括：
   * - 创建或更新用户信息
   * - 创建或获取房间信息
   * - 将用户添加到房间
   * - 将 Socket 加入 Socket.IO 房间
   * - 通知房间内其他用户有新用户加入
   * - 发送房间信息给新加入的用户
   *
   * @private
   * @param socket - Socket.IO Socket 实例
   * @param roomId - 房间 ID
   * @param userId - 用户 ID（可选，如果不提供则使用 socket.id）
   */
  private handleJoinRoom(
    socket: SocketIOSocket,
    roomId: string,
    userId?: string,
  ): void {
    const actualUserId = userId || socket.id;

    // 更新用户信息
    const userInfo: UserInfo = {
      userId: actualUserId,
      roomId,
      connected: true,
      joinedAt: Date.now(),
    };
    this.users.set(actualUserId, userInfo);
    this.socketToUser.set(socket.id, actualUserId);
    // 维护用户到 Socket 的映射，用于快速查找
    this.userToSocket.set(actualUserId, socket.id);

    // 获取或创建房间
    let room = this.rooms.get(roomId);
    if (!room) {
      room = {
        roomId,
        users: [],
        createdAt: Date.now(),
      };
      this.rooms.set(roomId, room);
    }

    // 将用户添加到房间
    if (!room.users.includes(actualUserId)) {
      room.users.push(actualUserId);
    }

    // 将 Socket 加入房间（Socket.IO 房间功能）
    socket.join(roomId);

    this.logger.info(
      `[SignalingServer] 用户 ${actualUserId} 加入房间 ${roomId}`,
    );

    // 通知房间内其他用户（使用 socket.to() 方法）
    socket.to(roomId).emit("user-joined", {
      userId: actualUserId,
      roomId,
    });

    // 发送房间信息给新加入的用户
    socket.emit("room-joined", {
      roomId,
      userId: actualUserId,
      users: room.users.filter((id) => id !== actualUserId),
    });
  }

  /**
   * 处理离开房间
   *
   * 处理用户离开房间的请求，包括：
   * - 从房间中移除用户
   * - 如果房间为空，删除房间
   * - 通知房间内其他用户有用户离开
   * - 从 Socket.IO 房间中移除 Socket
   * - 更新用户信息
   * - 清理用户到 Socket 的映射
   *
   * @private
   * @param socket - Socket.IO Socket 实例
   */
  private handleLeaveRoom(socket: SocketIOSocket): void {
    const userId = this.socketToUser.get(socket.id);
    if (!userId) return;

    const userInfo = this.users.get(userId);
    if (!userInfo || !userInfo.roomId) return;

    const roomId = userInfo.roomId;
    const room = this.rooms.get(roomId);

    if (room) {
      // 从房间中移除用户
      room.users = room.users.filter((id) => id !== userId);

      // 如果房间为空，删除房间
      if (room.users.length === 0) {
        this.rooms.delete(roomId);
      } else {
        // 通知房间内其他用户（使用 socket.to() 方法）
        socket.to(roomId).emit("user-left", {
          userId,
          roomId,
        });
      }
    }

    // 从 Socket.IO 房间中离开
    socket.leave(roomId);

    // 更新用户信息
    userInfo.roomId = undefined;
    userInfo.connected = false;

    // 清理用户到 Socket 的映射
    this.userToSocket.delete(userId);

    this.logger.info(`[SignalingServer] 用户 ${userId} 离开房间 ${roomId}`);
  }

  /**
   * 处理信令消息
   *
   * 处理 WebRTC 信令消息（offer、answer、ice-candidate），包括：
   * - 验证用户身份
   * - 验证用户是否在房间中
   * - 统计消息延迟
   * - 批量处理优化（对于 ICE candidates）
   * - 如果指定了接收者，转发给目标用户
   * - 如果没有指定接收者，广播给房间内所有其他用户
   *
   * @private
   * @param socket - Socket.IO Socket 实例
   * @param message - 信令消息对象
   */
  private handleSignaling(
    socket: SocketIOSocket,
    message: SignalingMessage,
  ): void {
    const startTime = Date.now();
    const userId = this.socketToUser.get(socket.id);
    if (!userId) {
      socket.emit("signaling", {
        type: "error",
        error: "用户未加入房间",
      });
      return;
    }

    const userInfo = this.users.get(userId);
    if (!userInfo || !userInfo.roomId) {
      socket.emit("signaling", {
        type: "error",
        error: "用户未加入房间",
      });
      return;
    }

    const roomId = userInfo.roomId;

    // 设置消息的发送者
    message.from = userId;
    message.roomId = roomId;

    // 处理架构模式切换消息
    if (message.type === "architecture-mode") {
      // 广播架构模式切换消息给房间内所有用户
      socket.to(roomId).emit("architecture-mode", {
        architectureMode: message.architectureMode,
        roomId,
      });
      return;
    }

    // 处理 SFU 相关消息（转发给 SFU 服务器或房间内其他用户）
    if (message.type.startsWith("sfu-")) {
      // SFU 消息需要特殊处理
      // 这里可以根据需要转发给 SFU 服务器或房间内其他用户
      // 暂时转发给房间内其他用户（实际应该转发给 SFU 服务器）
      socket.to(roomId).emit("signaling", message);
      return;
    }

    // 更新统计信息
    this.stats.messagesReceived++;
    this.stats.lastMessageTime = startTime;

    // ICE candidates 批量处理优化
    if (message.type === "ice-candidate") {
      this.queueMessage(roomId, message, socket);
    } else {
      // 其他消息类型立即发送
      this.sendMessage(message, socket, roomId);
    }

    // 记录消息处理延迟
    const latency = Date.now() - startTime;
    this.recordLatency(latency);
  }

  /**
   * 将消息加入批量处理队列
   *
   * ICE candidates 消息会被批量处理，减少网络开销。
   *
   * @private
   * @param roomId - 房间 ID
   * @param message - 信令消息
   * @param socket - Socket 实例
   */
  private queueMessage(
    roomId: string,
    message: SignalingMessage,
    _socket: SocketIOSocket,
  ): void {
    if (!this.messageQueue.has(roomId)) {
      this.messageQueue.set(roomId, []);
    }
    this.messageQueue.get(roomId)!.push(message);

    // 如果还没有定时器，创建一个
    if (!this.messageQueueTimers.has(roomId)) {
      const timer = setTimeout(() => {
        this.flushMessageQueue(roomId);
      }, this.batchDelay);
      this.messageQueueTimers.set(roomId, timer);
    }
  }

  /**
   * 刷新消息队列，批量发送消息
   *
   * 批量发送队列中的所有消息，减少网络开销。
   *
   * @private
   * @param roomId - 房间 ID
   */
  private flushMessageQueue(roomId: string): void {
    const messages = this.messageQueue.get(roomId);
    if (!messages || messages.length === 0) {
      this.messageQueue.delete(roomId);
      this.messageQueueTimers.delete(roomId);
      return;
    }

    const room = this.rooms.get(roomId);
    if (!room) {
      // 房间不存在，清理队列
      this.messageQueue.delete(roomId);
      this.messageQueueTimers.delete(roomId);
      return;
    }

    // 批量发送消息
    for (const message of messages) {
      // 找到发送者的 Socket
      const senderSocketId = this.userToSocket.get(message.from || "");
      if (!senderSocketId) continue;

      const namespace = this.io.of("/");
      const sockets = namespace.getSockets();
      const senderSocket = sockets.get(senderSocketId);
      if (!senderSocket) continue;

      this.sendMessage(message, senderSocket, roomId);
    }

    // 清理队列和定时器
    this.messageQueue.delete(roomId);
    this.messageQueueTimers.delete(roomId);
  }

  /**
   * 发送信令消息
   *
   * @private
   * @param message - 信令消息
   * @param socket - 发送者的 Socket
   * @param roomId - 房间 ID
   */
  private sendMessage(
    message: SignalingMessage,
    socket: SocketIOSocket,
    roomId: string,
  ): void {
    // 如果指定了接收者，只发送给该用户
    if (message.to) {
      const targetSocket = this.findSocketByUserId(message.to);
      if (targetSocket) {
        targetSocket.emit("signaling", message);
        this.stats.messagesSent++;
      }
    } else {
      // 广播给房间内其他用户（使用 socket.to() 方法）
      socket.to(roomId).emit("signaling", message);
      // 统计发送的消息数（广播给多个用户）
      const room = this.rooms.get(roomId);
      if (room) {
        this.stats.messagesSent += room.users.length - 1; // 排除发送者
      }
    }
  }

  /**
   * 记录消息延迟
   *
   * @private
   * @param latency - 延迟（毫秒）
   */
  private recordLatency(latency: number): void {
    this.messageLatencies.push(latency);

    // 限制延迟记录数量，避免内存泄漏
    if (this.messageLatencies.length > 1000) {
      this.messageLatencies.shift();
    }

    // 计算平均延迟
    const sum = this.messageLatencies.reduce((a, b) => a + b, 0);
    this.stats.averageLatency = sum / this.messageLatencies.length;

    // 如果延迟超过阈值，记录为延迟消息
    if (latency > 100) {
      this.stats.messagesDelayed++;
    }
  }

  /**
   * 根据用户 ID 查找 Socket
   *
   * 使用维护的 userId -> socketId 映射进行 O(1) 查找。
   *
   * @param userId - 用户 ID
   * @returns Socket 实例，如果用户不存在则返回 null
   */
  private findSocketByUserId(userId: string): SocketIOSocket | null {
    const socketId = this.userToSocket.get(userId);
    if (!socketId) {
      return null;
    }

    // 从 Socket.IO 服务器获取 Socket
    const namespace = this.io.of("/");
    const sockets = namespace.getSockets();
    return sockets.get(socketId) || null;
  }

  /**
   * 处理断开连接
   *
   * 处理客户端断开连接，包括：
   * - 处理用户离开房间
   * - 清理用户信息
   * - 清理 Socket 到用户的映射
   * - 清理用户到 Socket 的映射
   *
   * @private
   * @param socket - Socket.IO Socket 实例
   * @param reason - 断开连接的原因
   */
  private handleDisconnect(
    socket: SocketIOSocket,
    reason: string,
  ): void {
    const userId = this.socketToUser.get(socket.id);
    if (!userId) return;

    this.logger.info(`[SignalingServer] 用户 ${userId} 断开连接: ${reason}`);

    // 处理离开房间
    this.handleLeaveRoom(socket);

    // 清理用户信息
    this.socketToUser.delete(socket.id);
    this.userToSocket.delete(userId);
    this.users.delete(userId);
  }

  /**
   * 启动服务器
   *
   * 启动 Socket.IO 服务器并开始监听连接。
   *
   * @example
   * ```typescript
   * await server.listen();
   * console.log("服务器已启动");
   * ```
   */
  async listen(): Promise<void> {
    await this.io.listen();
    this.logger.info(
      `[SignalingServer] 信令服务器已启动，监听端口 ${
        this.io.options.port || 3000
      }`,
    );
  }

  /**
   * 关闭服务器
   *
   * 关闭所有连接并停止服务器。
   *
   * @example
   * ```typescript
   * await server.close();
   * console.log("服务器已关闭");
   * ```
   */
  async close(): Promise<void> {
    // 清理所有消息队列定时器
    for (const timer of this.messageQueueTimers.values()) {
      clearTimeout(timer);
    }
    this.messageQueueTimers.clear();
    this.messageQueue.clear();

    await this.io.close();
    this.logger.info("[SignalingServer] 信令服务器已关闭");
  }

  /**
   * 获取房间信息
   *
   * @param roomId - 房间 ID
   * @returns 房间信息，如果房间不存在则返回 undefined
   *
   * @example
   * ```typescript
   * const room = server.getRoom("room-123");
   * if (room) {
   *   console.log(`房间有 ${room.users.length} 个用户`);
   * }
   * ```
   */
  getRoom(roomId: string): RoomInfo | undefined {
    return this.rooms.get(roomId);
  }

  /**
   * 获取用户信息
   *
   * @param userId - 用户 ID
   * @returns 用户信息，如果用户不存在则返回 undefined
   */
  getUser(userId: string): UserInfo | undefined {
    return this.users.get(userId);
  }

  /**
   * 获取所有房间
   *
   * @returns 所有房间的信息数组
   *
   * @example
   * ```typescript
   * const rooms = server.getAllRooms();
   * console.log(`当前有 ${rooms.length} 个房间`);
   * ```
   */
  getAllRooms(): RoomInfo[] {
    return Array.from(this.rooms.values());
  }

  /**
   * 获取房间内的用户列表
   *
   * @param roomId - 房间 ID
   * @returns 房间内的用户 ID 数组
   *
   * @example
   * ```typescript
   * const users = server.getRoomUsers("room-123");
   * console.log(`房间内有 ${users.length} 个用户`);
   * ```
   */
  getRoomUsers(roomId: string): string[] {
    const room = this.rooms.get(roomId);
    return room ? [...room.users] : [];
  }

  /**
   * 获取服务器统计信息
   *
   * 返回服务器的统计信息，包括：
   * - `messagesReceived`: 已接收的消息数
   * - `messagesSent`: 已发送的消息数
   * - `messagesDelayed`: 延迟超过 100ms 的消息数
   * - `averageLatency`: 平均消息处理延迟（毫秒）
   * - `activeRooms`: 当前活跃房间数
   * - `activeUsers`: 当前活跃用户数
   *
   * @returns 服务器统计信息对象
   *
   * @example
   * ```typescript
   * const stats = server.getStats();
   * console.log(`平均延迟: ${stats.averageLatency}ms`);
   * console.log(`活跃房间: ${stats.activeRooms}`);
   * ```
   */
  getStats(): {
    messagesReceived: number;
    messagesSent: number;
    messagesDelayed: number;
    averageLatency: number;
    activeRooms: number;
    activeUsers: number;
  } {
    return {
      ...this.stats,
      activeRooms: this.rooms.size,
      activeUsers: this.users.size,
    };
  }

  /**
   * 重置统计信息
   *
   * 重置所有统计计数器，但保留当前活跃的房间和用户信息。
   *
   * @example
   * ```typescript
   * server.resetStats();
   * ```
   */
  resetStats(): void {
    this.stats = {
      messagesReceived: 0,
      messagesSent: 0,
      messagesDelayed: 0,
      averageLatency: 0,
      lastMessageTime: 0,
    };
    this.messageLatencies = [];
  }

  /**
   * 获取网络质量建议
   *
   * 根据消息延迟统计提供网络质量建议，帮助客户端调整媒体流质量。
   *
   * @param roomId - 房间 ID（可选，如果不提供则返回全局建议）
   * @returns 网络质量建议对象
   *
   * @example
   * ```typescript
   * const suggestion = server.getNetworkQualitySuggestion("room-123");
   * if (suggestion.quality === "poor") {
   *   // 建议客户端降低媒体流质量
   * }
   * ```
   */
  getNetworkQualitySuggestion(_roomId?: string): {
    quality: "good" | "fair" | "poor";
    averageLatency: number;
    messageLossRate: number;
    recommendation: string;
  } {
    const avgLatency = this.stats.averageLatency;
    const totalMessages = this.stats.messagesReceived;
    const delayedMessages = this.stats.messagesDelayed;
    const messageLossRate = totalMessages > 0
      ? (delayedMessages / totalMessages) * 100
      : 0;

    let quality: "good" | "fair" | "poor" = "good";
    let recommendation = "网络质量良好，可以保持当前媒体流质量";

    if (avgLatency > 200 || messageLossRate > 10) {
      quality = "poor";
      recommendation = "网络质量较差，建议降低媒体流质量（降低分辨率、帧率）";
    } else if (avgLatency > 100 || messageLossRate > 5) {
      quality = "fair";
      recommendation = "网络质量一般，建议适当降低媒体流质量或使用中等质量设置";
    }

    return {
      quality,
      averageLatency: avgLatency,
      messageLossRate,
      recommendation,
    };
  }
}

/**
 * WebRTC 管理器配置选项
 */
export interface WebRTCManagerOptions {
  /** 管理器名称（用于服务容器识别） */
  name?: string;
  /** 默认信令服务器配置 */
  defaultServerConfig?: SignalingServerOptions;
}

/**
 * WebRTC 管理器
 *
 * 管理多个 SignalingServer 实例，支持不同的配置
 */
export class WebRTCManager {
  /** 信令服务器实例映射表 */
  private servers: Map<string, SignalingServer> = new Map();
  /** 服务器配置映射表 */
  private configs: Map<string, SignalingServerOptions> = new Map();
  /** 默认服务器配置 */
  private defaultConfig?: SignalingServerOptions;
  /** 服务容器实例 */
  private container?: ServiceContainer;
  /** 管理器名称 */
  private readonly managerName: string;

  /**
   * 创建 WebRTC 管理器实例
   * @param options 管理器配置选项
   */
  constructor(options: WebRTCManagerOptions = {}) {
    this.managerName = options.name || "default";
    this.defaultConfig = options.defaultServerConfig;
  }

  /**
   * 获取管理器名称
   * @returns 管理器名称
   */
  getName(): string {
    return this.managerName;
  }

  /**
   * 设置服务容器
   * @param container 服务容器实例
   */
  setContainer(container: ServiceContainer): void {
    this.container = container;
  }

  /**
   * 获取服务容器
   * @returns 服务容器实例，如果未设置则返回 undefined
   */
  getContainer(): ServiceContainer | undefined {
    return this.container;
  }

  /**
   * 从服务容器创建 WebRTCManager 实例
   * @param container 服务容器实例
   * @param name 管理器名称（默认 "default"）
   * @returns 关联了服务容器的 WebRTCManager 实例
   */
  static fromContainer(
    container: ServiceContainer,
    name = "default",
  ): WebRTCManager | undefined {
    const serviceName = `webrtc:${name}`;
    return container.tryGet<WebRTCManager>(serviceName);
  }

  /**
   * 注册信令服务器配置
   * @param name 服务器名称
   * @param config 服务器配置
   */
  registerServer(name: string, config: SignalingServerOptions): void {
    this.configs.set(name, config);
  }

  /**
   * 获取或创建信令服务器
   * @param name 服务器名称
   * @returns SignalingServer 实例
   * @throws {Error} 如果未注册配置且没有默认配置
   */
  getServer(name: string): SignalingServer {
    let server = this.servers.get(name);
    if (!server) {
      const config = this.configs.get(name) || this.defaultConfig;
      if (!config) {
        throw new Error(`未找到名为 "${name}" 的信令服务器配置`);
      }
      server = new SignalingServer(config);
      this.servers.set(name, server);
    }
    return server;
  }

  /**
   * 检查是否存在指定名称的服务器
   * @param name 服务器名称
   * @returns 是否存在
   */
  hasServer(name: string): boolean {
    return this.servers.has(name) || this.configs.has(name);
  }

  /**
   * 移除服务器
   * @param name 服务器名称
   */
  async removeServer(name: string): Promise<void> {
    const server = this.servers.get(name);
    if (server) {
      await server.close();
      this.servers.delete(name);
    }
    this.configs.delete(name);
  }

  /**
   * 获取所有服务器名称
   * @returns 服务器名称数组
   */
  getServerNames(): string[] {
    const names = new Set([
      ...this.servers.keys(),
      ...this.configs.keys(),
    ]);
    return Array.from(names);
  }

  /**
   * 关闭所有服务器
   */
  async close(): Promise<void> {
    for (const server of this.servers.values()) {
      await server.close();
    }
    this.servers.clear();
  }
}

/**
 * 创建 WebRTCManager 的工厂函数
 * 用于服务容器注册
 * @param options WebRTC 管理器配置选项
 * @returns WebRTCManager 实例
 */
export function createWebRTCManager(
  options?: WebRTCManagerOptions,
): WebRTCManager {
  return new WebRTCManager(options);
}

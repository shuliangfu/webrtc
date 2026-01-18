/**
 * @module @dreamer/webrtc/client/sfu-adapter
 *
 * @fileoverview SFU 适配器
 * 用于处理 SFU 架构模式的连接管理，包括发布、订阅媒体流等功能
 */

import type {
  EventCallback,
  RTCConfiguration,
  RTCEvent,
  SFUOptions,
  SignalingMessage,
} from "../types.ts";

/**
 * SFU 适配器
 *
 * 负责管理与 SFU 服务器的连接，包括：
 * - 连接到 SFU 服务器
 * - 发布本地媒体流
 * - 订阅远程媒体流
 * - 处理 SFU 相关信令消息
 *
 * @example
 * ```typescript
 * const adapter = new SFUAdapter({
 *   url: "wss://sfu.example.com",
 *   simulcast: true,
 * });
 *
 * await adapter.connect();
 * await adapter.publish(localStream);
 * ```
 */
export class SFUAdapter {
  /** SFU 配置选项 */
  private sfuOptions: SFUOptions;
  /** WebRTC 配置 */
  private rtcConfiguration?: RTCConfiguration;
  /** 与 SFU 服务器的 RTCPeerConnection */
  private peerConnection?: RTCPeerConnection;
  /** 本地媒体流 */
  private localStream?: MediaStream;
  /** 远程媒体流映射（userId -> MediaStream） */
  private remoteStreams: Map<string, MediaStream> = new Map();
  /** 事件监听器 */
  private eventListeners: Map<RTCEvent, EventCallback[]> = new Map();
  /** 连接状态 */
  private connected: boolean = false;
  /** 信令消息处理器（由外部设置） */
  private signalingHandler?: (message: SignalingMessage) => void;

  /**
   * 创建 SFU 适配器实例
   *
   * @param sfuOptions - SFU 配置选项
   * @param rtcConfiguration - WebRTC 配置选项
   */
  constructor(
    sfuOptions: SFUOptions,
    rtcConfiguration?: RTCConfiguration,
  ) {
    this.sfuOptions = sfuOptions;
    this.rtcConfiguration = rtcConfiguration;
  }

  /**
   * 设置信令消息处理器
   *
   * @param handler - 信令消息处理函数
   */
  setSignalingHandler(handler: (message: SignalingMessage) => void): void {
    this.signalingHandler = handler;
  }

  /**
   * 连接到 SFU 服务器
   *
   * 创建与 SFU 服务器的 RTCPeerConnection，并建立连接。
   *
   * @returns Promise<void>
   */
  connect(): Promise<void> {
    if (this.connected) {
      return Promise.resolve();
    }

    // 创建 RTCPeerConnection
    this.peerConnection = new RTCPeerConnection(this.rtcConfiguration);

    // 设置事件监听器
    this.setupPeerConnectionHandlers();

    // 发送连接请求（通过信令服务器）
    if (this.signalingHandler) {
      this.signalingHandler({
        type: "sfu-connect",
        sfuUrl: this.sfuOptions.url,
      });
    }

    this.connected = true;
    return Promise.resolve();
  }

  /**
   * 断开与 SFU 服务器的连接
   */
  disconnect(): void {
    if (!this.connected) {
      return;
    }

    // 关闭所有远程流
    this.remoteStreams.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
    this.remoteStreams.clear();

    // 关闭本地流
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = undefined;
    }

    // 关闭 RTCPeerConnection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = undefined;
    }

    // 发送断开连接请求
    if (this.signalingHandler) {
      this.signalingHandler({
        type: "sfu-disconnect",
      });
    }

    this.connected = false;
  }

  /**
   * 发布本地媒体流
   *
   * 将本地媒体流发布到 SFU 服务器，供其他客户端订阅。
   *
   * @param stream - 本地媒体流
   * @returns Promise<void>
   */
  async publish(stream: MediaStream): Promise<void> {
    if (!this.peerConnection || !this.connected) {
      throw new Error("SFU 适配器未连接");
    }

    this.localStream = stream;

    // 将媒体流添加到 RTCPeerConnection
    stream.getTracks().forEach((track) => {
      this.peerConnection!.addTrack(track, stream);
    });

    // 创建 offer
    const offer = await this.peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });

    await this.peerConnection.setLocalDescription(offer);

    // 发送发布请求（通过信令服务器）
    if (this.signalingHandler) {
      this.signalingHandler({
        type: "sfu-publish",
        sdp: offer,
      });
    }
  }

  /**
   * 订阅远程用户的媒体流
   *
   * @param userId - 用户 ID
   * @returns Promise<MediaStream>
   */
  subscribe(userId: string): Promise<MediaStream> {
    if (!this.peerConnection || !this.connected) {
      return Promise.reject(new Error("SFU 适配器未连接"));
    }

    // 发送订阅请求（通过信令服务器）
    if (this.signalingHandler) {
      this.signalingHandler({
        type: "sfu-subscribe",
        userId,
      });
    }

    // 等待远程流（通过 track 事件）
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.peerConnection) {
          this.peerConnection.ontrack = null;
        }
        reject(new Error(`订阅用户 ${userId} 的流超时`));
      }, 10000);

      const onTrack = (event: RTCTrackEvent) => {
        if (event.streams && event.streams.length > 0) {
          const stream = event.streams[0];
          this.remoteStreams.set(userId, stream);
          clearTimeout(timeout);
          if (this.peerConnection) {
            this.peerConnection.ontrack = null;
          }
          resolve(stream);
        }
      };

      if (this.peerConnection) {
        this.peerConnection.ontrack = onTrack;
      }
    });
  }

  /**
   * 取消订阅远程用户的媒体流
   *
   * @param userId - 用户 ID
   */
  unsubscribe(userId: string): void {
    if (!this.connected) {
      return;
    }

    // 停止远程流
    const stream = this.remoteStreams.get(userId);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      this.remoteStreams.delete(userId);
    }

    // 发送取消订阅请求（通过信令服务器）
    if (this.signalingHandler) {
      this.signalingHandler({
        type: "sfu-unsubscribe",
        userId,
      });
    }
  }

  /**
   * 处理 SFU 信令消息
   *
   * 处理来自信令服务器的 SFU 相关消息，包括：
   * - sfu-stream-published: 远程用户发布了流
   * - sfu-stream-unpublished: 远程用户取消了流
   * - answer: SFU 服务器的 answer
   * - ice-candidate: SFU 服务器的 ICE candidate
   *
   * @param message - 信令消息
   */
  handleSignaling(message: SignalingMessage): void {
    if (!this.peerConnection || !this.connected) {
      return;
    }

    switch (message.type) {
      case "sfu-stream-published":
        // 远程用户发布了流，可以订阅
        this.emit("stream", {
          userId: message.userId,
          streamId: message.streamId,
        });
        break;

      case "sfu-stream-unpublished":
        // 远程用户取消了流
        this.unsubscribe(message.userId || "");
        break;

      case "answer":
        // SFU 服务器的 answer
        if (message.sdp) {
          this.peerConnection.setRemoteDescription(message.sdp);
        }
        break;

      case "ice-candidate":
        // SFU 服务器的 ICE candidate
        if (message.candidate) {
          this.peerConnection.addIceCandidate(message.candidate);
        }
        break;
    }
  }

  /**
   * 获取所有远程媒体流
   *
   * @returns 远程媒体流映射
   */
  getRemoteStreams(): Map<string, MediaStream> {
    return new Map(this.remoteStreams);
  }

  /**
   * 获取本地媒体流
   *
   * @returns 本地媒体流
   */
  getLocalStream(): MediaStream | undefined {
    return this.localStream;
  }

  /**
   * 检查是否已连接
   *
   * @returns 是否已连接
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 设置 RTCPeerConnection 事件处理器
   *
   * @private
   */
  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) {
      return;
    }

    // ICE candidate 事件
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.signalingHandler) {
        // 手动构建 candidate 对象（因为 RTCIceCandidate.toJSON() 可能不存在）
        // RTCIceCandidateInit 在全局作用域中定义
        const candidate = {
          candidate: event.candidate.candidate,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          sdpMid: event.candidate.sdpMid,
          usernameFragment: event.candidate.usernameFragment,
        };
        this.signalingHandler({
          type: "ice-candidate",
          candidate,
        });
      }
    };

    // Track 事件（接收远程流）
    this.peerConnection.ontrack = (event) => {
      if (event.streams && event.streams.length > 0) {
        const stream = event.streams[0];
        this.emit("track", { stream, track: event.track });
        this.emit("stream", { stream });
      }
    };

    // 连接状态变化
    this.peerConnection.onconnectionstatechange = () => {
      this.emit("connection-state-change", {
        state: this.peerConnection!.connectionState,
      });
    };

    // ICE 连接状态变化
    this.peerConnection.oniceconnectionstatechange = () => {
      this.emit("ice-connection-state-change", {
        state: this.peerConnection!.iceConnectionState,
      });
    };
  }

  /**
   * 添加事件监听器
   *
   * @param event - 事件类型
   * @param callback - 回调函数
   */
  on(event: RTCEvent, callback: EventCallback): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.push(callback);
    this.eventListeners.set(event, listeners);
  }

  /**
   * 移除事件监听器
   *
   * @param event - 事件类型
   * @param callback - 回调函数
   */
  off(event: RTCEvent, callback: EventCallback): void {
    const listeners = this.eventListeners.get(event) || [];
    const index = listeners.indexOf(callback);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  }

  /**
   * 触发事件
   *
   * @private
   * @param event - 事件类型
   * @param data - 事件数据
   */
  private emit(event: RTCEvent, data: any): void {
    const listeners = this.eventListeners.get(event) || [];
    listeners.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[SFUAdapter] 事件处理器错误:`, error);
      }
    });
  }
}

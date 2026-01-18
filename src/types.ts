/**
 * @module @dreamer/webrtc/types
 *
 * @fileoverview WebRTC 类型定义
 */

/**
 * WebRTC 浏览器类型声明
 * 这些类型在浏览器环境中可用，定义为模块类型以兼容 JSR
 * 注意：在浏览器环境中，这些类型由浏览器全局提供
 */

/**
 * RTCCertificate 类型（浏览器环境）
 */
export interface RTCCertificate {
  expires: number;
  getFingerprints(): RTCDtlsFingerprint[];
  [key: string]: unknown;
}

/**
 * RTCDtlsFingerprint 类型
 */
export interface RTCDtlsFingerprint {
  algorithm: string;
  value: string;
}

/**
 * RTCSessionDescriptionInit 类型
 */
export interface RTCSessionDescriptionInit {
  type: "offer" | "answer" | "pranswer" | "rollback";
  sdp?: string;
}

/**
 * RTCIceCandidateInit 类型
 */
export interface RTCIceCandidateInit {
  candidate?: string;
  sdpMLineIndex?: number | null;
  sdpMid?: string | null;
  usernameFragment?: string | null;
}

/**
 * MediaTrackConstraints 类型
 */
export interface MediaTrackConstraints {
  width?: number | { ideal?: number; min?: number; max?: number };
  height?: number | { ideal?: number; min?: number; max?: number };
  frameRate?: number | { ideal?: number; min?: number; max?: number };
  sampleRate?: number;
  channelCount?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
  [key: string]: unknown;
}

/**
 * ICE 服务器配置
 */
export interface ICEServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

/**
 * WebRTC 配置选项
 */
export interface RTCConfiguration {
  iceServers?: ICEServer[];
  iceTransportPolicy?: "all" | "relay";
  bundlePolicy?: "balanced" | "max-compat" | "max-bundle";
  rtcpMuxPolicy?: "negotiate" | "require";
  peerIdentity?: string;
  certificates?: RTCCertificate[] | any[];
}

/**
 * 架构模式
 * - "mesh": Mesh 架构（点对点，适合小规模 < 10 人）
 * - "sfu": SFU 架构（选择性转发，适合大规模 10+ 人）
 * - "auto": 自动切换（根据房间人数自动选择）
 */
export type ArchitectureMode = "mesh" | "sfu" | "auto";

/**
 * SFU 配置选项
 */
export interface SFUOptions {
  /** SFU 服务器 URL（必需） */
  url: string;
  /** SFU 服务器端口（可选，默认：443） */
  port?: number;
  /** 是否启用 Simulcast（多分辨率流，默认：false） */
  simulcast?: boolean;
  /** 是否启用 SVC（可扩展视频编码，默认：false） */
  svc?: boolean;
}

/**
 * 信令消息类型
 */
export type SignalingMessageType =
  | "offer"
  | "answer"
  | "ice-candidate"
  | "join-room"
  | "leave-room"
  | "user-joined"
  | "user-left"
  | "error"
  | "ready"
  | "sfu-connect"
  | "sfu-disconnect"
  | "sfu-publish"
  | "sfu-subscribe"
  | "sfu-unsubscribe"
  | "sfu-stream-published"
  | "sfu-stream-unpublished"
  | "architecture-mode";

/**
 * 信令消息
 */
export interface SignalingMessage {
  type: SignalingMessageType;
  from?: string;
  to?: string;
  roomId?: string;
  data?: any;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  error?: string;
  /** 架构模式（用于 architecture-mode 消息） */
  architectureMode?: ArchitectureMode;
  /** SFU 服务器信息（用于 sfu-connect 消息） */
  sfuUrl?: string;
  /** 流 ID（用于 SFU 相关消息） */
  streamId?: string;
  /** 用户 ID（用于 SFU 相关消息） */
  userId?: string;
}

/**
 * 房间信息
 */
export interface RoomInfo {
  roomId: string;
  users: string[];
  createdAt: number;
}

/**
 * 用户信息
 */
export interface UserInfo {
  userId: string;
  roomId?: string;
  connected: boolean;
  joinedAt?: number;
}

/**
 * 媒体流配置
 */
export interface MediaStreamConstraints {
  audio?: boolean | MediaTrackConstraints;
  video?: boolean | MediaTrackConstraints;
  screen?: boolean;
}

/**
 * 视频质量配置
 */
export interface VideoQuality {
  width?: number;
  height?: number;
  frameRate?: number;
  bitrate?: number;
}

/**
 * 音频质量配置
 */
export interface AudioQuality {
  sampleRate?: number;
  channelCount?: number;
  bitrate?: number;
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

/**
 * 连接状态
 */
export type ConnectionState =
  | "new"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed"
  | "closed";

/**
 * ICE 连接状态
 */
export type ICEConnectionState =
  | "new"
  | "checking"
  | "connected"
  | "completed"
  | "failed"
  | "disconnected"
  | "closed";

/**
 * 信令服务器选项
 */
export interface SignalingServerOptions {
  port?: number;
  host?: string;
  path?: string;
  cors?: {
    origin?: string | string[] | ((origin: string) => boolean);
    credentials?: boolean;
  };
  stunServers?: ICEServer[];
  turnServers?: ICEServer[];
}

/**
 * WebRTC 客户端选项
 */
export interface RTCClientOptions {
  /** 信令服务器 URL（必需） */
  signalingUrl: string;
  /** 房间 ID（可选） */
  roomId?: string;
  /** 用户 ID（可选） */
  userId?: string;
  /** WebRTC 配置选项 */
  rtcConfiguration?: RTCConfiguration;
  /** 媒体流约束（可选，设置为 false 则不自动获取媒体） */
  mediaConstraints?: MediaStreamConstraints | false;
  /** 是否自动连接（默认：true） */
  autoConnect?: boolean;
  /** 是否自动重连（默认：true） */
  reconnect?: boolean;
  /** 重连间隔（毫秒，默认：1000） */
  reconnectInterval?: number;
  /** 最大重连次数（默认：5） */
  maxReconnectAttempts?: number;
  /** 连接池大小（默认：5） */
  connectionPoolSize?: number;
  /** 是否启用质量自适应（默认：true） */
  enableQualityAdaptation?: boolean;
  /** 架构模式（默认："auto"） */
  architectureMode?: ArchitectureMode;
  /** SFU 配置选项（当 architectureMode 为 "sfu" 或 "auto" 时使用） */
  sfuOptions?: SFUOptions;
  /** Mesh 模式切换阈值（默认：10，房间人数 >= 此值时切换到 SFU） */
  meshToSFUThreshold?: number;
}

/**
 * 事件回调类型
 */
export type EventCallback<T = any> = (data: T) => void | Promise<void>;

/**
 * 信令事件
 */
export type SignalingEvent =
  | "open"
  | "close"
  | "error"
  | "message"
  | "room-joined"
  | "room-left"
  | "user-joined"
  | "user-left";

/**
 * WebRTC 事件
 */
export type RTCEvent =
  | "connection-state-change"
  | "ice-connection-state-change"
  | "ice-candidate"
  | "track"
  | "stream"
  | "data-channel"
  | "error";

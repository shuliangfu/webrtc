/**
 * @module @dreamer/webrtc/client/types
 *
 * @fileoverview WebRTC 客户端浏览器类型定义
 * 这些类型在浏览器环境中可用，定义为模块类型以兼容 JSR
 */

/**
 * RTCPeerConnection 类型（浏览器环境）
 * 在浏览器中使用时，这些类型由浏览器提供
 */
export type RTCPeerConnection = typeof globalThis extends {
  RTCPeerConnection: infer T;
} ? T
  : any;

/**
 * MediaStream 类型（浏览器环境）
 */
export type MediaStream = typeof globalThis extends {
  MediaStream: infer T;
} ? T
  : any;

/**
 * MediaStreamTrack 类型（浏览器环境）
 */
export type MediaStreamTrack = typeof globalThis extends {
  MediaStreamTrack: infer T;
} ? T
  : any;

/**
 * RTCSessionDescriptionInit 类型
 */
export interface RTCSessionDescriptionInit {
  type: "offer" | "answer" | "pranswer" | "rollback";
  sdp?: string;
}

/**
 * RTCSessionDescription 类型
 */
export interface RTCSessionDescription {
  type: "offer" | "answer" | "pranswer" | "rollback";
  sdp: string;
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
 * RTCIceCandidate 类型
 */
export interface RTCIceCandidate {
  candidate: string;
  sdpMLineIndex: number | null;
  sdpMid: string | null;
  usernameFragment: string | null;
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
 * MediaStreamConstraints 类型
 */
export interface MediaStreamConstraints {
  audio?: boolean | MediaTrackConstraints;
  video?: boolean | MediaTrackConstraints;
}

/**
 * RTCCertificate 类型
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
 * RTCDataChannel 类型
 */
export interface RTCDataChannel {
  send(data: string | ArrayBuffer | ArrayBufferView): void;
  close(): void;
  label: string;
  readyState: string;
  onopen: ((event: Event) => void) | null;
  onclose: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent) => void) | null;
  onerror: ((event: Event) => void) | null;
}

/**
 * RTCDataChannelInit 类型
 */
export interface RTCDataChannelInit {
  ordered?: boolean;
  maxPacketLifeTime?: number;
  maxRetransmits?: number;
  protocol?: string;
  negotiated?: boolean;
  id?: number;
}

/**
 * RTCStatsReport 类型
 */
export interface RTCStatsReport {
  values(): IterableIterator<RTCStats>;
  forEach(callback: (value: RTCStats, key: string) => void): void;
  get(key: string): RTCStats | undefined;
  has(key: string): boolean;
  entries(): IterableIterator<[string, RTCStats]>;
  keys(): IterableIterator<string>;
}

/**
 * RTCStats 类型
 */
export interface RTCStats {
  type: string;
  id: string;
  timestamp: number;
  [key: string]: unknown;
}

/**
 * RTCRtpSender 类型
 */
export interface RTCRtpSender {
  track: MediaStreamTrack | null;
}

/**
 * RTCOfferOptions 类型
 */
export interface RTCOfferOptions {
  offerToReceiveAudio?: boolean;
  offerToReceiveVideo?: boolean;
}

/**
 * RTCAnswerOptions 类型
 */
export interface RTCAnswerOptions {
  [key: string]: unknown;
}

/**
 * RTCPeerConnectionIceEvent 类型
 */
export interface RTCPeerConnectionIceEvent {
  candidate: RTCIceCandidate | null;
}

/**
 * RTCTrackEvent 类型
 */
export interface RTCTrackEvent {
  track: MediaStreamTrack;
  streams: MediaStream[];
}

/**
 * RTCDataChannelEvent 类型
 */
export interface RTCDataChannelEvent {
  channel: RTCDataChannel;
}

/**
 * MediaTrackSettings 类型
 */
export interface MediaTrackSettings {
  width?: number;
  height?: number;
  frameRate?: number;
  [key: string]: unknown;
}

/**
 * Navigator.mediaDevices 类型
 */
export interface MediaDevices {
  getUserMedia(
    constraints: MediaStreamConstraints,
  ): Promise<MediaStream>;
  getDisplayMedia(
    constraints: MediaStreamConstraints,
  ): Promise<MediaStream>;
}

/**
 * 浏览器全局对象类型（用于访问浏览器 API）
 * 在浏览器环境中，这些构造函数由浏览器提供
 *
 * 注意：在浏览器编译时，这些值从 globalThis 获取，确保有实际的运行时值
 */
export const RTCPeerConnection: {
  new (configuration?: any): RTCPeerConnection;
} = typeof globalThis !== "undefined" && (globalThis as any).RTCPeerConnection
  ? (globalThis as any).RTCPeerConnection
  : (class {
    constructor(_configuration?: any) {
      throw new Error(
        "RTCPeerConnection is not available in this environment",
      );
    }
  } as any);

export const MediaStream: {
  new (tracks?: MediaStreamTrack[]): MediaStream;
} = typeof globalThis !== "undefined" && (globalThis as any).MediaStream
  ? (globalThis as any).MediaStream
  : (class {
    constructor(_tracks?: MediaStreamTrack[]) {
      throw new Error("MediaStream is not available in this environment");
    }
  } as any);

export const RTCSessionDescription: {
  new (descriptionInitDict: RTCSessionDescriptionInit): RTCSessionDescription;
} = typeof globalThis !== "undefined" &&
    (globalThis as any).RTCSessionDescription
  ? (globalThis as any).RTCSessionDescription
  : (class {
    constructor(_descriptionInitDict: RTCSessionDescriptionInit) {
      throw new Error(
        "RTCSessionDescription is not available in this environment",
      );
    }
  } as any);

export const RTCIceCandidate: {
  new (candidateInitDict?: RTCIceCandidateInit): RTCIceCandidate;
} = typeof globalThis !== "undefined" && (globalThis as any).RTCIceCandidate
  ? (globalThis as any).RTCIceCandidate
  : (class {
    constructor(_candidateInitDict?: RTCIceCandidateInit) {
      throw new Error(
        "RTCIceCandidate is not available in this environment",
      );
    }
  } as any);

export const navigator: {
  mediaDevices?: MediaDevices;
} = typeof globalThis !== "undefined" && (globalThis as any).navigator
  ? (globalThis as any).navigator
  : ({} as any);

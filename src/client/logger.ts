/**
 * @module @dreamer/webrtc/client/logger
 *
 * @fileoverview WebRTC 客户端日志管理器
 * 使用 @dreamer/logger 的客户端日志功能，提供统一的日志接口
 */

import {
  createLogger as createClientLogger,
  type Logger as ClientLogger,
} from "@dreamer/logger/client";

/**
 * WebRTC 客户端日志器实例
 * 使用统一的日志前缀和配置
 */
export const logger: ClientLogger = createClientLogger({
  level: "warn", // 默认只输出 warn 及以上级别
  prefix: "[RTCClient]",
  timestamp: false, // 浏览器控制台自带时间戳，不需要额外添加
});

/**
 * 创建带自定义前缀的子日志器
 *
 * @param prefix - 日志前缀
 * @returns 子日志器实例
 */
export function createLogger(prefix: string): ClientLogger {
  return logger.child({ prefix });
}

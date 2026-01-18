/**
 * @fileoverview 测试工具函数
 * 提供测试中常用的工具函数
 */

import { detectRuntime, IS_BUN } from "@dreamer/runtime-adapter";

/**
 * 测试使用的固定端口
 * 所有测试共享同一个端口，每个测试结束后会关闭服务器释放端口
 */
const TEST_PORT = 30000;

/**
 * 获取测试端口
 *
 * @returns 测试端口号（固定端口）
 */
export function getAvailablePort(): number {
  // 使用固定端口，每个测试结束后会关闭服务器释放端口
  return TEST_PORT;
}

/**
 * 延迟函数
 *
 * @param ms - 延迟毫秒数
 * @returns Promise
 */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 等待服务器启动完成
 * 在 Bun 环境下需要更长的延迟来确保服务器完全启动
 * 并且通过 HTTP 请求验证服务器是否真的准备好了
 *
 * @param serverUrl - 服务器 URL（可选，如果提供则进行实际连接测试）
 * @returns Promise
 */
export async function waitForServerReady(serverUrl?: string): Promise<void> {
  // Bun 环境下需要更长的延迟来确保服务器完全启动
  if (IS_BUN) {
    await delay(500); // 增加延迟时间

    // 如果提供了 serverUrl，尝试连接验证服务器是否真的准备好了
    if (serverUrl) {
      let retries = 5;
      while (retries > 0) {
        try {
          const response = await fetch(`${serverUrl}/socket.io/`, {
            method: "GET",
            signal: AbortSignal.timeout(1000),
          });
          // 如果能够收到响应（即使是 404），说明服务器已经启动
          if (
            response.status === 200 || response.status === 404 ||
            response.status === 400
          ) {
            // 服务器已准备好
            await delay(100); // 额外等待确保 WebSocket 升级也准备好
            return;
          }
        } catch (error) {
          // 连接失败，继续重试
          await delay(100);
          retries--;
          continue;
        }
      }
      // 如果所有重试都失败，至少等待一段时间
      await delay(100);
    } else {
      // 没有提供 URL，只等待
      await delay(100);
    }
  } else {
    // Deno 环境下使用较短的延迟
    await delay(100);
  }
}

/**
 * 等待端口释放
 * 在 Bun 环境下，服务器关闭后端口可能需要更长时间才能释放
 * 通过尝试连接来检查端口是否已释放
 *
 * @param port - 端口号
 * @param maxRetries - 最大重试次数，默认 15
 * @returns Promise
 */
export async function waitForPortRelease(
  port: number,
  maxRetries: number = 15,
): Promise<void> {
  if (IS_BUN) {
    // Bun 环境下需要更长的等待时间
    // 先等待一个基础时间，让服务器有时间关闭
    await delay(500);

    // 然后尝试连接检查端口是否已释放
    let retries = maxRetries;
    while (retries > 0) {
      try {
        // 尝试连接端口，如果连接失败说明端口已释放
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 200);
        try {
          const response = await fetch(`http://localhost:${port}`, {
            method: "GET",
            signal: controller.signal,
          });
          // 如果连接成功，说明端口仍被占用，继续等待
          await delay(100);
          retries--;
        } catch (error) {
          // 连接失败，说明端口可能已释放
          // 额外等待一段时间确保端口完全释放
          await delay(100);
          clearTimeout(timeoutId);
          return;
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (error) {
        // 连接失败，说明端口可能已释放
        await delay(100);
        return;
      }
    }
    // 如果所有重试都失败，至少等待一段时间
    await delay(100);
  } else {
    // Deno 环境下使用较短的延迟
    await delay(100);
  }
}

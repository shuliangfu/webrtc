/**
 * @fileoverview 测试工具函数
 * 提供测试中常用的工具函数，通过 @dreamer/runtime-adapter 兼容 Deno 与 Bun
 */

import { IS_BUN, serve } from "@dreamer/runtime-adapter";

/**
 * 测试使用的固定端口（供同步 getAvailablePort 递增使用）
 */
const TEST_PORT_BASE = 30000;

/**
 * 同步端口递增计数器，保证同一进程内每次调用得到不同端口，减少复用导致的 AddrInUse
 */
let _portCounter = 0;

/**
 * 获取测试端口（同步）
 * 每次调用返回 30000、30001、30002…，用于仅需「任意端口号」、不立刻 bind 的场景（如构造配置）。
 *
 * @returns 测试端口号
 */
export function getAvailablePort(): number {
  return TEST_PORT_BASE + (_portCounter++ % 1000);
}

/**
 * 获取当前真正可用的端口（异步）
 * 通过 @dreamer/runtime-adapter 的 serve({ port: 0 }) 在 Deno/Bun 下由系统分配空闲端口，
 * 避免与其它进程或本进程其它测试冲突，解决 AddrInUse。在 beforeAll/beforeEach 中启动服务器时应用此函数。
 *
 * @returns 当前可用的端口号
 */
export async function getAvailablePortAsync(): Promise<number> {
  let resolvePort: (p: number) => void;
  const portPromise = new Promise<number>((r) => {
    resolvePort = r;
  });
  const handle = serve(
    {
      port: 0,
      host: "127.0.0.1",
      onListen: (params) => resolvePort(params.port),
    },
    () => new Response(""),
  );
  const port = await portPromise;
  await handle.shutdown();
  return port;
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
        } catch (_error) {
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
          const _response = await fetch(`http://localhost:${port}`, {
            method: "GET",
            signal: controller.signal,
          });
          // 如果连接成功，说明端口仍被占用，继续等待
          await delay(100);
          retries--;
        } catch (_error) {
          // 连接失败，说明端口可能已释放
          // 额外等待一段时间确保端口完全释放
          await delay(100);
          clearTimeout(timeoutId);
          return;
        } finally {
          clearTimeout(timeoutId);
        }
      } catch (_error) {
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

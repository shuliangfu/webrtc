## [1.0.0-beta.5] - 2026-02-20

### 变更

- Chore: release v1.0.0-beta.5（许可证 Apache-2.0、依赖升级、文档整理）。

---

# 变更日志

@dreamer/webrtc 的所有重要变更均记录于此。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

---

## [1.0.0] - 2026-02-19

### 新增

- **正式版发布**：首个正式版本，API 稳定。
- **信令服务端**（`src/server/`）：基于 Socket.IO
  的信令；mesh、SFU、自动模式；房间与连接管理。
- **客户端**（`src/client/`）：RTCClient、连接池、质量适配、自动重连；浏览器兼容的
  client 模块。
- **国际化（i18n）**：服务端文案（未找到信令服务器配置等）提供 en-US 与
  zh-CN，基于 `@dreamer/i18n`；语言由 `LANGUAGE` / `LC_ALL` / `LANG` 决定；从
  `./i18n.ts` 导出
  `$tr`、`setWebrtcLocale`、`detectLocale`。客户端模块暂不翻译。

### 兼容性

- Deno 2.6+
- Bun 1.3.5+
- 现代浏览器（客户端）

# @dreamer/webrtc

> 📖 English | [中文文档](./docs/zh-CN/README.md)

> A Socket.IO-based WebRTC real-time audio/video library with full signaling
> server and client implementation, compatible with Deno and Bun.

[![JSR](https://jsr.io/badges/@dreamer/webrtc)](https://jsr.io/@dreamer/webrtc)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)
[![Tests](https://img.shields.io/badge/tests-182%20passed-brightgreen)](./docs/en-US/TEST_REPORT.md)

---

## Features

WebRTC real-time audio/video with signaling server (Socket.IO) and client.
One-to-one and multi-room. Mesh, SFU, and Auto modes. Connection pooling,
quality adaptation, network monitoring, auto-reconnect. Compatible with Deno,
Bun, and modern browsers.

---

## Installation

### Deno

```bash
deno add jsr:@dreamer/webrtc
```

### Bun

```bash
bunx jsr add @dreamer/webrtc
```

### Client (browser)

```typescript
import { RTCClient } from "jsr:@dreamer/webrtc/client";
```

---

## Documentation

- **Full documentation (English + 中文)**:
  [docs/zh-CN/README.md](./docs/zh-CN/README.md)
- **Test report (EN)**: [docs/en-US/TEST_REPORT.md](./docs/en-US/TEST_REPORT.md)
- **Test report (中文)**:
  [docs/zh-CN/TEST_REPORT.md](./docs/zh-CN/TEST_REPORT.md)

---

## License

Apache License 2.0 — see [LICENSE](./LICENSE)

---

<div align="center">**Made with ❤️ by Dreamer Team**</div>

## [1.0.0-beta.5] - 2026-02-20

### Changed

- Chore: release v1.0.0-beta.5 (license Apache-2.0, dependency bumps, docs
  cleanup).

---

# Changelog

All notable changes to @dreamer/webrtc are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

---

## [1.0.0] - 2026-02-19

### Added

- **Official release**: First official version with stable API.
- **Signaling server** (`src/server/`): Socket.IO-based signaling; mesh, SFU,
  auto modes; room and connection handling.
- **Client** (`src/client/`): RTCClient, connection pooling, quality adaptation,
  auto-reconnect; browser-compatible client module.
- **Internationalization (i18n)**: Server-side messages (signaling server config
  not found, etc.) in en-US and zh-CN via `@dreamer/i18n`; locale from
  `LANGUAGE` / `LC_ALL` / `LANG`; `$tr`, `setWebrtcLocale`, `detectLocale`
  exported from `./i18n.ts`. Client module remains untranslated.

### Compatibility

- Deno 2.6+
- Bun 1.3.5+
- Modern browsers (for client)

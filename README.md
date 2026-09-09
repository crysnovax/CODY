# CODY AI

CODY AI is a Node.js WhatsApp automation bot for personal accounts, powered by the [`plogme`](https://www.npmjs.com/package/plogme) runtime. It combines AI, media tools, group administration, status utilities, owner controls, and persistent session handling in a plugin-based application.

> **Runtime requirement:** CODY is built and tested against `plogme`. The dependency is declared as `plogme` in `package.json` and `package-lock.json`.

[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen?logo=node.js)](https://nodejs.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Runtime](https://img.shields.io/badge/runtime-plogme-5b21b6)](https://www.npmjs.com/package/plogme)

## Contents

- [Features](#features)
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [Pairing and sessions](#pairing-and-sessions)
- [Command examples](#command-examples)
- [Reliability and deployment](#reliability-and-deployment)
- [Plugin development](#plugin-development)
- [Security and responsible use](#security-and-responsible-use)
- [Troubleshooting](#troubleshooting)

## Features

### Core automation

- Plugin-based command discovery with owner, sudo, group, downloader, AI, media, and utility commands.
- Persistent multi-file authentication through `plogme`.
- Pairing-code startup flow and optional `SESSION_ID` restoration.
- Runtime configuration through `.setvar`, `.getvar`, and `.delvar`.
- Render-friendly HTTP health endpoints and keep-alive support.

### New reliability and protection features

- **Stable reconnects:** transient 408 transport timeouts reconnect without deleting valid authentication files.
- **Panel-safe disconnect handling:** logged-out and connection-replaced events no longer terminate the web process automatically.
- **SAVE_MODE:** optionally blocks unsaved contacts that message or call the account.
- **Anti-call controls:** whitelist and blacklist management, unknown-caller handling, schedules, and caller rejection.
- **Anti-group-status:** detects supported group-status mention envelopes, including wrapped messages and the `antigroupstatus` alias.
- **Opt-in PLOGME:** automatic PLOGME responses are disabled unless explicitly enabled.
- **MP3-only `.play`:** returns one `audio/mpeg` message without an extra preview or success reaction.

### Media, AI, and administration

- YouTube audio downloads with scraper and RapidAPI fallback paths.
- Audio effects, stickers, image tools, converters, OCR, translation, and text-to-speech.
- AI chat, image generation integrations, coding assistance, and media analysis commands.
- Group welcome/goodbye, moderation, anti-link, mute, warning, tag, and status tools.
- Owner-only operational controls, statistics, status posting, and runtime settings.

## Requirements

- Node.js **20 or newer**.
- npm 8 or newer.
- A WhatsApp account for the bot session.
- A Linux VPS, Render service, or another always-on Node.js host for reliable uptime.
- At least 512 MB RAM for a minimal installation; media and AI workloads may require more.

## Installation

```bash
git clone https://github.com/crysnovax/CODY.git
cd CODY
npm install
npm start
```

The installation uses the `plogme` dependency declared in the repository.

For development:

```bash
npm run dev
```

Run the focused regression tests:

```bash
node --test tests/antigm.test.js \
  tests/gstatus-grammar-and-mention.test.js \
  tests/poststory-status-api.test.js
```

Run the complete suite:

```bash
npm test
```

## Configuration

CODY reads environment values and runtime settings from the repository configuration files. Start by reviewing `settings/config.js` and the deployment environment. Never commit private session files, API keys, or owner numbers.

Typical values include:

```dotenv
OWNER_NUMBER=2348000000000
OWNER_NAME=Your Name
BOT_NAME=CODY
PREFIX=.
SESSION_ID=
CODY_API_KEY=
SAVED_NUMBERS=2348000000000,2348111111111
SUDO_NUMBERS=2348222222222
```

The exact environment variables used by a command may vary. Use `.getvar` to inspect a runtime value and `.setvar KEY=value` to change a supported setting without editing source files.

## Pairing and sessions

On a first start, CODY requests the WhatsApp number and displays a pairing code. On the phone, open **WhatsApp → Settings → Linked Devices → Link a Device**, then enter the code.

For hosted deployment, a session can be restored with `SESSION_ID`. CODY supports its encoded session format and the Cloudflare KV short-ID format:

```dotenv
SESSION_ID=CODY_AI!KV:your-short-id
```

Authentication is stored under `sessions/`. Keep this directory persistent on the host. Do not delete it during a transient 408, network timeout, or reconnect attempt; deleting valid credentials forces a new pairing and can make a healthy session appear to log out.

## Command examples

All examples use the default `.` prefix. Replace it if your configuration uses another prefix.

### 1. SAVE_MODE: block unsaved messages and calls

SAVE_MODE is opt-in. When enabled, an incoming DM or call from a contact that is not in the synced address book or `SAVED_NUMBERS` is blocked. The owner and sudo numbers are always protected.

```text
.savemode on
.savemode
.savemode off
```

Example output:

```text
SAVE_MODE is currently ON ✓

Usage:
.savemode on|off

Saved list fallback: .setvar SAVED_NUMBERS=2348xxx,2349xxx
```

When the address book is unavailable, use an explicit fallback list:

```text
.setvar SAVED_NUMBERS=2348000000000,2348111111111
.savemode on
```

SAVE_MODE is separate from anti-call’s global unknown-caller switch. It blocks unsaved contacts for both message and call events when enabled.

### 2. Anti-call manager

The anti-call manager supports a global unknown-caller policy plus always-active whitelist and blacklist entries.

```text
.anticall on
.anticall status
.anticall reason Calls are not accepted right now.
.anticall unknownreason Unknown callers are blocked. Please message first.
```

Manage lists:

```text
.anticall whitelist add 2348111111111
.anticall whitelist list
.anticall whitelist remove 2348111111111

.anticall reject add 2348222222222
.anticall reject list
.anticall reject remove 2348222222222
```

Schedule blocking:

```text
.anticall schedule always 22:00 06:00
.anticall schedule off
```

A phone number can initially be stored as a pending number and upgraded to the correct WhatsApp LID when the first call event provides it.

### 3. Anti-group-status

The anti-group-status command detects supported status-mention message envelopes and can be enabled or disabled by the owner. The command accepts both the original short name and the explicit alias.

```text
.antigm on
.antigm status
.antigroupstatus on
.antigroupstatus off
```

The detector handles messages wrapped in supported WhatsApp envelope types instead of relying only on a top-level message object. This is useful when a status mention is delivered through a nested or forwarded structure.

### 4. Gstatus utilities

Create and broadcast group-status content with named backgrounds, captions, and routing options:

```text
.gstatus hello from CODY
.gstatusbg neon hello from CODY
.gstatusall
.gstatusall blue Team update
```

When replying to media, the command can preserve the replied media and apply an explicit caption/background according to the command options.

### 5. PLOGME auto-replies

PLOGME responses are **disabled by default**. Enable them only when you want the automated response workflow active:

```text
.plogme on
.plogme status
.plogme off
```

An empty or missing toggle does not activate automatic replies. This prevents an unexpected busy or “text me later” response on a fresh deployment.

### 6. `.play`: one MP3 response

Search by title:

```text
.play Assurance by Davido
```

Or use a YouTube URL:

```text
.play https://youtu.be/VIDEO_ID
```

The command resolves the audio through its configured scraper/fallback chain and sends one playable `audio/mpeg` message with an `.mp3` filename. It does not send a second rich preview, image card, or success reaction.

### 7. Runtime variables

```text
.setvar SAVE_MODE=true
.getvar SAVE_MODE
.delvar SAVE_MODE
```

Use runtime variables for supported operational settings rather than editing generated database files while the bot is running.

## Reliability and deployment

### Render

The repository includes Render configuration. Use the repository’s Node build process and preserve the lockfile:

```bash
npm ci --omit=dev --ignore-scripts
npm start
```

Before deploying, verify locally:

```bash
npm ci --omit=dev --ignore-scripts
node --check index.js
npm test
```

Keep the session storage persistent where the host supports disks or volumes. A stateless restart without the `sessions/` directory requires pairing again.

### Reconnect behavior

CODY distinguishes transient transport problems from invalid credentials:

- **408 / QR reference timeout:** reconnects while preserving authentication state.
- **Bad MAC / stale app-state keys:** performs targeted stale-key cleanup before reconnecting.
- **Logged out:** keeps the panel process alive and reports that re-pairing is required.
- **Connection replaced:** keeps the panel process alive and reports that another linked session took over.

A repeated 440 conflict generally means another WhatsApp Web session is active. Remove duplicate linked devices before deleting CODY’s session files.

## Plugin development

Commands are CommonJS modules loaded from `src/Commands`. A minimal command looks like this:

```js
module.exports = {
  name: 'hello',
  alias: ['hi'],
  desc: 'Send a greeting',
  category: 'Tools',

  async execute(sock, message, { reply, args }) {
    const name = args.join(' ') || 'there';
    await reply(`Hello, ${name}!`);
  }
};
```

A media command can use the active `plogme` socket:

```js
module.exports = {
  name: 'sendmp3',
  category: 'Tools',

  async execute(sock, message, { reply }) {
    if (!message.quoted?.download) return reply('Reply to an audio message.');
    const audio = await message.quoted.download();
    await sock.sendMessage(message.chat, {
      audio,
      mimetype: 'audio/mpeg',
      ptt: false,
      fileName: 'audio.mp3'
    }, { quoted: message });
  }
};
```

Use existing command modules as the compatibility reference for `plogme` methods, message serialization, LID handling, media downloads, and status APIs.

## Security and responsible use

This project automates a personal WhatsApp account. Follow WhatsApp’s terms and applicable laws. Use moderation and blocking features transparently, protect your session directory, and never publish pairing codes or session IDs. The maintainers are not responsible for account restrictions caused by misuse, spam, abusive automation, or unsafe third-party services.

## Troubleshooting

### The bot keeps requesting a new pairing

1. Confirm that `sessions/` is persistent and writable.
2. Confirm that the host is not deleting the session directory during deploys.
3. Do not remove credentials after a normal 408 timeout.
4. Check WhatsApp Linked Devices for duplicate or unwanted sessions.
5. Re-pair only after WhatsApp reports that the existing session is actually logged out.

### SAVE_MODE does not block someone

Confirm that it is enabled and that the sender is not saved, the owner, or a sudo number:

```text
.savemode
.getvar SAVED_NUMBERS
```

For calls, ensure the incoming event reaches the running process and that the socket exposes `updateBlockStatus` and `rejectCall`.

### `.play` fails to return audio

Check the Render logs for scraper or fallback errors, verify outbound network access, and confirm that the required API environment variables are configured. The command expects a reachable audio provider; YouTube metadata alone is not an audio file.

### The panel stops responding

Check the health endpoint and process logs. The connection manager is designed to keep the HTTP panel alive across logged-out and connection-replaced events, but the WhatsApp session must be re-paired after a genuine logout.

## License

CODY AI is released under the MIT License. See [`LICENSE`](LICENSE) for details.

## Links

- [CODY repository](https://github.com/crysnovax/CODY)
- [plogme on npm](https://www.npmjs.com/package/plogme)
- [CODY issues](https://github.com/crysnovax/CODY/issues)
- [CODY pull requests](https://github.com/crysnovax/CODY/pulls)

Maintained by **crysnovax**.

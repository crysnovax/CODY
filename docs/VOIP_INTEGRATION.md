# CODY VOIP integration

CODY remains the owner of the authenticated WhatsApp session. The VOIP capability attaches to the same live socket through the published `voip-plogme` transport and does not create a second WhatsApp login.

## Current phase

The first integration phase is an opt-in passive listener. It starts only when `CODY_VOIP_ENABLED=true`, waits for the existing CODY socket to reach `open`, and then attaches the Plogme `VoipClient`. Incoming calls are captured in `globalThis.__codyPendingVoipCall` and logged. Automatic answering is intentionally disabled until the real handset smoke test and the CODY response/TTS bridge are validated.

The feature is disabled by default, so existing CODY startup and WhatsApp messaging are unchanged.

## Configuration

```env
CODY_VOIP_ENABLED=false
PLOGME_VOIP_RESOURCES=call-resources
```

The resources directory must contain the runtime files expected by the Plogme VOIP implementation:

```text
call-resources/
└── assets/
    └── wasm/
        ├── whatsapp.wasm
        └── worker-modules.js
```

Keep these runtime assets private and do not expose Chrome remote debugging beyond localhost while obtaining them.

## Installed packages

CODY uses the published beta layers:

- `voip-core@0.1.0-beta.0`
- `voip-plogme@0.1.0-beta.0`
- `voip-tinyasr@0.1.0-beta.0`
- `voip-tts@0.1.0-beta.0`

The umbrella `plogme-voip` package is still developed in the VOIP monorepo and is not yet published. The next phase will connect its response and TTS callbacks after passive call detection is verified.

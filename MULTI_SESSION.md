# CODYMINI multi-session deployment

CODYMINI is built directly from `crysnovax/CODY`. The WhatsApp connection, pairing flow, reconnect behavior, commands, plugins, and panel behavior remain CODY’s implementation.

The only runtime isolation layer is the per-account process directory:

```text
multi-session/accounts/<account-id>/
├── account.json        # ownership/runtime metadata
└── app/
    ├── sessions/       # WhatsApp auth state for this account only
    └── database/       # config and state for this account only
```

Each account runs a normal CODY `index.js` process. Pairing uses the unchanged CODY `library/connection/connection.js` through `multi-session/pair-runner.js`. There is no Render-specific runtime and no replacement WhatsApp implementation.

## Panel variables

Set these in the panel:

```text
CODYMINI_CONTROL_TOKEN=<long random secret>
CODYMINI_ACCOUNTS_ROOT=/path/to/persistent/codymini/accounts
PORT=<panel-assigned port, if required>
```

Start command:

```bash
npm start
```

The control API provides:

- `GET /health`
- `GET /v1/accounts`
- `POST /v1/accounts/<id>/pair` with `{ "phone": "international-number" }`
- `GET /v1/accounts/<id>/status`
- `POST /v1/accounts/<id>/stop`
- `POST /v1/accounts/<id>/restart`
- `POST /v1/accounts/<id>/unlink`

All control requests require `Authorization: Bearer <CODYMINI_CONTROL_TOKEN>`.

The Telegram control bot is responsible for mapping each Telegram user to an account ID and calling this panel API. The panel process owns the actual CODY child processes and their isolated sessions/configuration.

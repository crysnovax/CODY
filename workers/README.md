# DramaBox worker

This worker is intended to run on the phone/Termux network that can access `sharet.dramabox.com`. CODY sends the exact share URL to `POST /v1/dramabox`; the worker runs `social-dl` locally, converts the selected stream to MP4, and streams the MP4 back to CODY.

## Termux setup

```sh
pkg update
pkg install nodejs ffmpeg
cd /path/to/CODY
npm ci
export DRAMABOX_WORKER_TOKEN='use-a-long-random-secret'
export DRAMABOX_WORKER_HOST='127.0.0.1'
export DRAMABOX_WORKER_PORT='8787'
node workers/dramabox-worker.js
```

Check it locally:

```sh
curl http://127.0.0.1:8787/health
```

The worker must be reachable by the hosted CODY instance through an HTTPS URL. Prefer a private tunnel such as Tailscale or an authenticated HTTPS reverse proxy rather than exposing port `8787` directly. Configure CODY with:

```dotenv
DRAMABOX_WORKER_URL=https://your-worker-host.example/v1/dramabox
DRAMABOX_WORKER_TOKEN=use-a-long-random-secret
```

The token must be identical on both sides. The worker accepts only HTTPS `sharet.dramabox.com/play` URLs and refuses to start without a token.

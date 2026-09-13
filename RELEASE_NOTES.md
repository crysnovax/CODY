# CODY AI — Sponsor Button and Reliability Release Notes

> **Project:** CODY AI  
> **Repository:** [`crysnovax/CODY`](https://github.com/crysnovax/CODY)  
> **Related PR:** [#98 — Restore CODY sponsor button](https://github.com/crysnovax/CODY/pull/98)  
> **Previous reliability PR:** [#96 — Avoid panel port conflict on Heroku and Render](https://github.com/crysnovax/CODY/pull/96)

## Overview

This release restores CODY’s sponsor experience and improves the way sponsorship actions are delivered across supported WhatsApp runtimes.

CODY now provides a dedicated sponsor command, aliases for donation/support requests, and a working sponsor button in the creator panel. The implementation uses the native `plogme` rich-button grid when available and falls back to a normal URL button and plain link when running on an older runtime.

The release also includes the recent hosted-deployment reliability fix that prevents the internal panel connector from competing with the main dashboard for Heroku or Render’s single public port.

## Highlights

- Added the `.sponsor` command.
- Added `.donate` and `.supportcody` aliases.
- Restored a working **Sponsor CODY** button in the `.repo` creator panel.
- Added a configurable `SPONSOR_URL` environment variable.
- Added a safe default GitHub Sponsors URL.
- Added compatibility fallback for runtimes without `sendRichButtonGrid`.
- Added regression coverage for rich-button delivery, fallback delivery, and the creator-panel button.
- Prevented Heroku/Render `EADDRINUSE` startup failures caused by two servers binding the same `PORT`.

## Sponsor command

Use any of the following commands:

```text
.sponsor
.donate
.supportcody
```

The command sends a **Sponsor CODY** URL button that opens the configured sponsorship page.

### Default sponsor URL

If no environment override is supplied, CODY uses:

```text
https://github.com/sponsors/crysnovax
```

### Custom sponsor URL

To use another official sponsorship or support page, set:

```dotenv
SPONSOR_URL=https://example.com/your-official-support-page
```

Restart CODY after changing the environment variable.

## Creator panel button

The `.repo` command now sends the creator panel and a separate rich Sponsor CODY button when the active `plogme` runtime supports rich button grids:

```text
.repo
```

The button payload uses:

```js
{
  id: 'cody_sponsor',
  text: 'Sponsor CODY',
  url: 'https://github.com/sponsors/crysnovax'
}
```

The creator panel remains usable even if the rich-grid helper is unavailable.

## Runtime compatibility

### Modern `plogme` runtime

When `sendRichButtonGrid` is available, CODY sends a native rich card:

```js
await sock.sendRichButtonGrid(chatId, {
  text: 'Support CODY development',
  footer: 'Thank you for supporting CRYSNOVA AI',
  cards: [{
    title: 'Sponsor CODY',
    buttons: [{
      id: 'cody_sponsor',
      text: 'Sponsor CODY',
      url: 'https://github.com/sponsors/crysnovax'
    }]
  }]
});
```

### Older runtime fallback

If the rich-grid helper is unavailable, CODY sends a normal URL-button payload and includes the plain link in the message text:

```js
await sock.sendMessage(chatId, {
  text: 'Support CODY development:\nhttps://github.com/sponsors/crysnovax',
  buttons: [{
    text: 'Sponsor CODY',
    url: 'https://github.com/sponsors/crysnovax'
  }]
});
```

If sending the button itself fails, the command still replies with the sponsorship URL so the action is not silently lost.

## Hosted deployment reliability

Heroku and Render provide one public listener through the `PORT` environment variable. CODY’s main dashboard owns that port.

The internal panel connector now uses:

```text
PANEL_API_PORT || configured panel API port || 9000
```

This prevents both servers from attempting to bind the same port and avoids errors such as:

```text
Error: listen EADDRINUSE
at listenInCluster (node:net:...)
```

### Recommended deployment settings

```bash
npm ci --omit=dev --ignore-scripts
npm start
```

For the optional internal panel connector, configure a separate port:

```dotenv
PANEL_API_PORT=9000
```

The platform-provided `PORT` should remain reserved for CODY’s main dashboard.

## Upgrade instructions

1. Pull the latest CODY branch after [PR #98](https://github.com/crysnovax/CODY/pull/98) is merged.
2. Install dependencies using the lockfile:

   ```bash
   npm ci --omit=dev --ignore-scripts
   ```

3. Optionally configure a custom sponsor destination:

   ```dotenv
   SPONSOR_URL=https://example.com/official-support-page
   ```

4. Restart the bot.
5. Test the sponsorship flow:

   ```text
   .sponsor
   .donate
   .repo
   ```

6. On Heroku or Render, ensure the internal panel connector is not configured to use the same port as the platform’s `PORT`.

## Validation

The full CODY test suite passes:

```text
91 tests passed
0 failed
```

Sponsor-specific regression coverage includes:

- Default sponsor URL payload generation.
- Rich `sendRichButtonGrid` delivery.
- Older-runtime normal-button fallback.
- Sponsor button delivery from the `.repo` creator panel.

Changed JavaScript files also pass Node syntax validation.

## Files changed

```text
src/Commands/Core/sponsor.js
src/Commands/Core/⎙.js
tests/sponsor.test.js
```

## Pull request

[PR #98 — Restore CODY sponsor button](https://github.com/crysnovax/CODY/pull/98)

## Related reliability fix

[PR #96 — Avoid panel port conflict on Heroku and Render](https://github.com/crysnovax/CODY/pull/96)

## Notes

- The default sponsor destination is a public URL and can be overridden with `SPONSOR_URL`.
- CODY does not process payments inside WhatsApp; the button opens the configured external page.
- Users should verify that any custom sponsor URL belongs to the official project before publishing it.

## License

See the project [`LICENSE`](https://github.com/crysnovax/CODY/blob/main/LICENSE) for licensing terms.

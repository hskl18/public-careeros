# CareerOS v0.2.0 Release Checklist

This checklist prepares v0.2.0 without creating a Git tag or GitHub Release.

## Version and contract

- [ ] `package.json` reports `0.2.0`.
- [ ] `GET /api/version` reports `careeros` version `0.2.0`.
- [ ] Workspace export reports schema version 2 and round-trips through strict import validation.
- [ ] Public docs describe the local connector boundary without live Gmail or benchmark claims.

## Gmail recovery

- [ ] The persisted sync state covers disconnected, authorizing, catching up, idle, degraded, reconnect required, and paused.
- [ ] A bounded page stores its cursor and merged records atomically.
- [ ] Pause and process restart preserve the next-page checkpoint.
- [ ] Duplicate messages and source labels do not create duplicate evidence or review mutations.
- [ ] Current-key, previous-key recovery, rotation, corruption, missing-key, and expired-token paths have deterministic tests.
- [ ] Diagnostics contain no access token, refresh token, client secret, raw response, or stack trace.

## User flows

- [ ] Fake Gmail authorization and first sync work through Settings.
- [ ] Rate-limit retry and reconnect-required states remain visible and actionable.
- [ ] Evidence review acceptance and dismissal persist through the user interface.
- [ ] Local export includes sync state but excludes token material.
- [ ] Local delete clears workspace and token data after exact confirmation.
- [ ] Desktop and mobile screenshots show no horizontal overflow or browser console errors.
- [ ] Keyboard navigation reaches connector actions and all controls keep visible labels.

## Verification

```bash
pnpm install --frozen-lockfile
pnpm ci:public
git diff --check
```

- [ ] The public safety scan finds no secrets, personal email, raw provider payload, local path, or local data artifact.
- [ ] Unit, integration, deterministic evaluation, build, browser smoke, and fake Gmail E2E checks pass.
- [ ] Git status contains only intentional source, test, and hand-written documentation changes.
- [ ] The pull request targets `main`, remains unmerged, and contains no tag or release action.

## External evidence boundary

Real Gmail credentials and inbox data are outside this public release check.
The fake adapter and fixture server verify documented Gmail response shapes and local recovery behavior without proving live Google OAuth configuration or behavior against a real mailbox.
Vercel preview checks may verify the credential-free application, but they do not prove persistent hosted sync because the public deployment uses ephemeral local state unless separately configured.

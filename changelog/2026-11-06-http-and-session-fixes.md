## Summary

Fix the blank screen after sign-in on self-hosted instances served over plain
HTTP, and stop failing every request with "invalid or expired token" once a
session expires.

## Changes

- Gravatar hashing uses WebCrypto when available and falls back to a small
  pure-JS SHA-256 where `crypto.subtle` is missing (plain HTTP), so the avatar
  still shows (fixes #70)
- Add a top-level error boundary: a render error now shows a message with a
  reload button instead of a blank page
- On a 401 for a request that carried a token, drop the stale session (the
  current mission is kept); in a trusted network sign in again silently and
  retry once, otherwise ask the user to sign in again (fixes #75)

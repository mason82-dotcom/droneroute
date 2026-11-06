## Summary

Self-hosted instances can sign in clients from trusted networks automatically,
so nobody is asked for a password at home.

## Changes

- New `TRUSTED_NETWORKS` setting (CIDRs or addresses, IPv4 and IPv6) and
  optional `TRUSTED_USER_EMAIL`
- New `POST /api/auth/trusted`: clients from a trusted network get a session for
  one shared local account (created on first use, no password, not an admin);
  everyone else gets 403, and the route is 404 when the feature is off or in
  cloud mode
- `/api/config` exposes `trustedLogin`; the app signs in silently on start in a
  trusted network and refreshes that session, while personal accounts keep
  working as before
- Tests for network parsing and the sign-in route

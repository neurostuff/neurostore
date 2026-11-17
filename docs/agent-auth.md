# Authenticating AI agents to Neurostore and Compose

The decision is [ADR 0021](adr/0021-agents-act-for-users-on-an-agents-audience.md). This page covers the options that were weighed, the Auth0 setup, and how an agent signs in.

## What existed (2026-11-16)

- **One Auth0 API for both backends.** `decode_token` in Store and Compose checks the RS256 signature, `iss` and `aud`, and nothing else.
  - Any token for the audience, from any application in the tenant, has the user's full power, `admin` included.
  - `sub` is `users.external_id`, and a user new to a service is created on its first write.
  - The JWKS was fetched on every request.
- **Machine-to-machine clients** get `sub = <client_id>@clients`. ns-pond's client needs the `admin` role granted in the database, and Compose's own client is the `compose_bot`.
- **API keys** (`nsk_…`, #1902) are per user, with scopes `read`/`write`, revocable, and checked by Compose through `/api-keys/introspect`. A key of an admin acts as admin.
- **The MCP server** (#1949) is read-only and anonymous.
- **Both tenants** advertise PKCE S256, public clients (`none`), the device-code, refresh-token and token-exchange grants, and `/oauth/revoke`. Dynamic client registration and client ID metadata documents (CIMD) are off.

## What the docs say (read 2026-11-16)

- **MCP authorization (spec 2026-07-28).**
  - The MCP server publishes RFC 9728 protected-resource metadata and accepts only tokens whose audience is its own URL (RFC 8707 `resource`).
  - It must not pass a token through to an upstream API.
  - Clients register by CIMD (recommended) or pre-registration. DCR is deprecated. PKCE is required.
- **Auth0 Auth for MCP (GA 2026-05-06).**
  - The Resource Parameter Compatibility Profile maps `resource` to `aud`.
  - CIMD registration is GA when an admin imports the URL. Dynamic CIMD is Early Access.
  - On-Behalf-Of token exchange swaps the user's MCP token for a token for another of our APIs. Auth0 validates the subject token itself, and the new token keeps `sub` and adds `act`.
  - OBO's rate limit is 2/s on Free, 8/s on Essentials and Professional, and 30/s on Enterprise, so the MCP server caches exchanged tokens.
- **Token Vault** is for third-party providers' tokens (Google, GitHub). CIBA, for asynchronous approval of a risky action, needs Enterprise or an add-on. Neither applies yet.
- **Scopes.** With RBAC off, a user token carries the API permissions the application asks for, capped by that application's user-delegated client grant. Scopes narrow what an agent may do relative to its user, while our database still decides what the user may do.
- **Revocation.** Access tokens can't be revoked. Use a short lifetime, rotating refresh tokens (`/oauth/revoke` ends a whole family), and the user's Authorized Applications page.
- **M2M quota.** 1,000 client-credentials tokens a month on Free and Essentials, and 5,000 on Professional.

## Candidates

| | A. Delegated OAuth, agents API (chosen) | B. Per-agent M2M clients | C. API keys only |
| --- | --- | --- | --- |
| Acts as | the signed-in user (`sub`) | `<client_id>@clients`, mapped to an owner in a new table | the key's owner |
| Consent | per app and scope, in Auth0 | none: an admin creates the client | the user creates the key |
| Setup per agent | none (sign in once) | an Auth0 application and secret, made by an admin | a key, pasted |
| claude.ai / MCP | yes, by OBO from the MCP server | no (they use user flows) | no |
| Revocation | refresh tokens at once; access tokens within 1 h | delete the grant | at once |
| Auth0 cost | none | the M2M quota | none |

## Auth0 changes

**Staging (`neurosynth-staging.us.auth0.com`), done 2026-11-17 through Auth0's MCP server:**
- **The agents API** `https://staging.neurostore.xyz/agents/` was created as specified below, with consent shown (`skip_consent_for_verifiable_first_party_clients: false`).
- **No new application:** the tenant is at its application limit. Agents use the existing native app `neurosynth-cli`, updated additively:
  - the device-code grant and the three callbacks were added;
  - its existing grants, its callback `http://127.0.0.1:5000/callback`, its name and its refresh-token settings are unchanged.
  - Nothing in the repos, the env files (laptop, beast, staging host) or the last day of Auth0 logs referenced it.
- **Not done, so make these in the dashboard when wanted:**
  - rotating refresh tokens on `neurosynth-cli`;
  - Per-app authorization on the agents API, plus a user-delegated grant for `neurosynth-cli`. The MCP server's grant tool only makes M2M grants.

  While the API's user policy stays `allow_all`, any first-party app can get an agents token. Such a token can do less than that user's login token, never more.

**Production (`neurosynth.us.auth0.com`): not done.** It may have the same application limit.

The spec, per tenant:

1. **The agents API.** Applications → APIs → Create.
   - Identifier: `https://neurostore.org/agents/` (staging `https://staging.neurostore.xyz/agents/`). It must match `AUTH0_AGENT_AUDIENCE`.
   - Signing algorithm: RS256.
   - Permissions: `read` (read Neurostore and Compose as you) and `write` (create and change your records; includes read).
   - Maximum access-token lifetime: 3600 s. Allow Offline Access: on.
   - Leave RBAC off. Application access for user flows: "Per-app authorization" (`require_client_grant`).
2. **One public application for agents,** "Neurostore agents": a Native application with no secret (token endpoint authentication `none`).
   - Grants: Authorization Code, Refresh Token, Device Code.
   - Refresh tokens: rotating, with an idle lifetime of 30 days.
   - Allowed callbacks: `https://claude.ai/api/mcp/auth_callback`, `http://localhost:33418/callback`, `http://127.0.0.1:33418/callback`. The port is Claude Code's `--callback-port`; pick one and tell users.
   - APIs tab: authorize it for the agents API with `read` and `write` (a user-delegated client grant).
   - Send its client id to whoever writes the agents' setup. It isn't secret.
3. **Later, for the hosted MCP server** (follow-up on #1949):
   - An API with identifier `https://neurostore.org/mcp`.
   - Under Settings → Advanced, the Resource Parameter Compatibility Profile and "Include Issuer in Authorization Responses".
   - A Custom API client linked to the MCP API, with On-Behalf-Of enabled and a user-delegated grant to the agents API.
   - Later still, CIMD once dynamic CIMD is GA. CIMD clients are third-party apps: they need domain-level connections, and the tenant must have no active Rules.

Nothing in the backends needs an `.env` change: the agents audience is a default in `ProductionConfig` and `StagingConfig`, and `AUTH0_AGENT_AUDIENCE` overrides it. Setting it to an empty value refuses every agent token.

## How an agent signs in (device flow)

A CLI agent or script signs in once, then refreshes without the user:

```bash
curl -s https://neurosynth.us.auth0.com/oauth/device/code \
  -d client_id="$NEUROSTORE_AGENT_CLIENT_ID" \
  -d audience=https://neurostore.org/agents/ \
  -d scope="openid read write offline_access"
```

1. The user opens `verification_uri_complete` from the response and approves.
2. The agent polls `/oauth/token` with `grant_type=urn:ietf:params:oauth:grant-type:device_code` and the `device_code` until it gets tokens.
3. It sends `Authorization: Bearer <access_token>` to `https://neurostore.org/api/` and `https://compose.neurosynth.org/api/`.
4. When the token expires, it trades the refresh token at `/oauth/token` with `grant_type=refresh_token`.

Ask for only `read` for an agent that shouldn't write. On staging, use the `neurosynth-staging` tenant, the `neurosynth-cli` client id and audience `https://staging.neurostore.xyz/agents/`.

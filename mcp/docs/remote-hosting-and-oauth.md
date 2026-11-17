# Hosting neurostore-mcp, and signing in

Status 2026-11-17: built. The hosted server is not yet deployed. The Auth0 setup below is made on production and staging; the client secrets are not yet in either `.env`. The decision on agent tokens is ADR 0021 (`docs/adr/0021-agents-act-for-users-on-an-agents-audience.md`).

## Where it runs

- **The service:** `neurostore-mcp` in `store/docker-compose.yml`, built from `mcp/Dockerfile`.
  - It calls Store inside the stack (`http://neurostore:8000/api`), so nginx's per-client limit on `/api/query/` doesn't throttle every agent at once.
  - Compose is called at `NEUROSTORE_MCP_COMPOSE_API_URL`. The staging and dev deploys set this to their own Compose.
- **The deploy:** the service is in the compose profile `mcp`, so a bare `docker compose up` leaves it out. `scripts/deploy/deploy_environment.sh` builds and restarts it by name with `store_nginx`. In production, run `docker compose up -d --build neurostore-mcp` from `store/`.
- **nginx** serves two paths:
  - `/mcp`, with buffering off and a 300 s read timeout;
  - `/.well-known/oauth-protected-resource/mcp`, the RFC 9728 metadata.

  claude.ai drops the `Authorization` header across a cross-host redirect, so both are served on the same host.
- **Sessions:** the server is stateless and answers with JSON, not SSE, so any worker can take any request.

## How a sign-in works

1. **Reads stay anonymous.** Without a token, the server passes a request straight to the MCP app. A `tools/call` of a tool that needs a user is the exception: it gets HTTP 401 with `WWW-Authenticate: Bearer resource_metadata=".../.well-known/oauth-protected-resource/mcp"` (`auth.LazyAuth`).
   - The tools that need a user are every write, plus the reads the spec marks as JWT-only (meta-analysis jobs).
   - All tools are listed to everyone, so an agent knows writes exist.
2. **The client signs the user in with Auth0.** The metadata names `https://neurosynth.us.auth0.com/` as the authorization server.
   - The client sends `resource=https://neurostore.org/mcp`, which the Resource Parameter Compatibility Profile turns into the token's audience.
   - The user consents to `read` and `write`.
3. **Each request's token is checked:** an RS256 signature against the tenant's JWKS, `iss`, and `aud = https://neurostore.org/mcp`. A bad token gets 401 `invalid_token`, even on a read, so the client refreshes it.
   - A write without the `write` scope gets 403 `insufficient_scope, scope="write"`, so the client can ask for more.
4. **The server swaps the token (`auth.TokenExchange`).** It exchanges the user's token for an agents-API token with Auth0's On-Behalf-Of grant (`urn:ietf:params:oauth:grant-type:token-exchange`, audience `https://neurostore.org/agents/`), and caches it until it expires.
   - Every call to Store or Compose for that user carries the agents token.
   - The token keeps `sub` (the user) and adds `act` (this server's client), nesting the client the user signed in through as `act.act`. The backends log `act.sub`.
   - The backends treat it as an agent: its scopes are enforced, the user's roles are dropped, and its writes are logged with `actor=<this client>`.
   - The MCP spec forbids forwarding the client's own token, and the server never does.
   - Auth0 rate-limits On-Behalf-Of per tenant (2/s on Free, 8/s on Essentials and Professional), which the cache keeps well below.
   - The exchange refuses `openid` ("ID tokens (openid scope) are not supported for on-behalf-of token exchange", staging 2026-11-17), so the agents token can't be used at `/userinfo`. Instead the post-login Action "Neurostore user name" (`mcp/auth0/neurostore-user-name.js`, on the Login flow of both tenants) adds the user's display name to agents tokens as `https://neurostore.org/name`, and Store and Compose name a new user from it. Without the Action, a user whose first write comes through the server is named "Unknown".

## Auth0 changes, per tenant

**Production, 2026-11-17: steps 1–4 done.**
- Step 1: the API `https://neurostore.org/mcp` (id `6afbcff2fa8fcf0c2be04035`).
- Step 2: both settings on; discovery reports `authorization_response_iss_parameter_supported: true`.
- Step 3: the Custom API client "Neurostore MCP server" (client id `XioZhXmGdh3uWmVGMjxNynBrCgS3nmdL`), On-Behalf-Of on. The agents API's user policy is `allow_all`, so its user-delegated access needs no per-app grant.
- Step 4: nothing needed while the MCP API's user policy is `allow_all`. A device-code request for it through "Neurostore agents" succeeds.
- Not yet done: Allow Skipping User Consent on the agents API (step 3), so exchanges fail until it is on.

Auth0's MCP server can't do steps 2 and 3 (no tenant-settings tool; its app and grant tools can't set `app_type: resource_server` or `token_exchange`), so they were done in the dashboard.

**Staging** (`neurosynth-staging.us.auth0.com`, 2026-11-17): steps 1–4 done.
- Step 1: the API "Neurostore MCP (staging)", `https://staging.neurostore.xyz/mcp` (id `6afc99299706952d0484b1cc`), set up like production's.
  - The tenant is at its API limit, so Auth0 couldn't add the usual auto-created test app and showed an error, but the API was created.
- Step 2: both settings on.
- Step 3: "Neurostore MCP server (staging)" (client id `kLBZbOywoE6D9rGcX7FwxU6sjo9cXnel`), On-Behalf-Of on. The agents API is `https://staging.neurostore.xyz/agents/`, user policy `allow_all`. To make room, "Auth0 Management API (Test Application)" was deleted; no deploy env used it.
- Step 4: users sign in with `neurosynth-cli`, which already allows the claude.ai and port-33418 callbacks. A device-code request for the MCP API through it succeeds.
- Allow Skipping User Consent is on for the agents API. A real exchange then works: a `read write` sign-in for the MCP API, exchanged with the server's client on the staging host, gave an agents token with `aud` `https://staging.neurostore.xyz/agents/`, the user's `sub`, `act.sub` = the server's client, `act.act.sub` = `neurosynth-cli`, and the scope asked for (`read write`, or `read` when only that was asked).
- For staging's `store/.env.staging`: `NEUROSTORE_MCP_PUBLIC_URL=https://staging.neurostore.xyz`, `NEUROSTORE_MCP_AUTH0_DOMAIN=neurosynth-staging.us.auth0.com`, `NEUROSTORE_MCP_AGENT_AUDIENCE=https://staging.neurostore.xyz/agents/`, plus that client's id and secret.

1. **An API for the MCP server.**
   - Identifier `https://neurostore.org/mcp`, RS256.
   - Permissions `read` and `write`, matching the agents API.
   - Access-token lifetime 3600 s. Allow Offline Access on.
2. **Settings → Advanced:**
   - Resource Parameter Compatibility Profile: on;
   - Include Issuer in Authorization Responses: on.
3. **A Custom API client for the server:**
   - `app_type: resource_server`, `resource_server_identifier: https://neurostore.org/mcp`, with a secret.
   - Token Exchange → On-Behalf-Of Token Exchange: on (`token_exchange.allow_any_profile_of_type: ["on_behalf_of_token_exchange"]`).
   - APIs → the agents API → User-Delegated Access, `read` and `write`.
   - The agents API needs **Allow Skipping User Consent** on. Without it every exchange gets 400 `invalid_request`: "The API must have 'Allow Skipping User Consent for Verifiable First-Party Clients' enabled" (staging, 2026-11-17).
   - Its client id and secret go in `store/.env` as `NEUROSTORE_MCP_CLIENT_ID` and `NEUROSTORE_MCP_CLIENT_SECRET`.
4. **The client users sign in with:** the existing public app "Neurostore agents". It already allows `https://claude.ai/api/mcp/auth_callback` and port 33418 on localhost.
   - Give it access to the MCP API. Its user policy is `allow_all` unless per-app authorization is set.
   - Users paste its client id into claude.ai's Advanced settings, or pass it to `claude mcp add --client-id`.
   - Once Auth0's dynamic CIMD is GA, claude.ai can register itself and the paste goes away. Leave DCR off.
5. **Then set the rest of `store/.env`:** `NEUROSTORE_MCP_PUBLIC_URL=https://neurostore.org`, `NEUROSTORE_MCP_AUTH0_DOMAIN=neurosynth.us.auth0.com`, `NEUROSTORE_MCP_AGENT_AUDIENCE=https://neurostore.org/agents/`. Restart `neurostore-mcp`.

**To check after setup:**
- `GET /.well-known/oauth-protected-resource/mcp` returns the resource and the tenant.
- An anonymous `tools/call` of `create_studyset` gets 401 with the metadata URL.
- A connector sign-in in claude.ai, then one `create_studyset`. The Store log shows `agent write POST /api/studysets/ ... actor=<client id>`.

## Open questions

- **Mixed open and protected tools in claude.ai.** Claude's connector docs support it, and the MCP spec says clients act on a 401 for any request. This server only challenges `tools/call`, so it needs one end-to-end test in claude.ai.
- **Exchanged scopes.** On staging the exchanged token carried exactly the scopes asked for (`read write`, or `read`); the server never asks for more than the subject token has. Whether Auth0 would also refuse a scope the subject token lacks is untested.

## Sources (read 2026-11-11 and 2026-11-17)

- MCP specification, Authorization: https://modelcontextprotocol.io/specification/latest/basic/authorization
- Anthropic, Building connectors, authentication: https://claude.com/docs/connectors/building/authentication.md
- Auth0, On-Behalf-Of Token Exchange: https://auth0.com/docs/secure/call-apis-on-users-behalf/on-behalf-of-token-exchange.md
- Auth0 for MCP, calling your APIs on a user's behalf: https://auth0.com/ai/docs/mcp/get-started/call-your-apis-on-users-behalf.md
- Auth0, Resource Parameter Compatibility Profile: https://auth0.com/ai/docs/mcp/guides/resource-param-compatibility-profile.md

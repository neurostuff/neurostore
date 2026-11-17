# Hosting neurostore-mcp, and signing in

Status 2026-11-17: built. The hosted server is not yet deployed. The Auth0 setup below is made, and an On-Behalf-Of exchange checked, on production and staging; both `store/.env` files have all five sign-in variables. The decision on agent tokens is ADR 0021 (`docs/adr/0021-agents-act-for-users-on-an-agents-audience.md`).

## Where it runs

- **The service:** `neurostore-mcp` in `store/docker-compose.yml`, built from `mcp/Dockerfile`.
  - It calls Store inside the stack (`http://neurostore:8000/api`), so nginx's per-client limit on `/api/query/` doesn't throttle every agent at once.
  - Compose is called at `http://compose:8000/api` over `proxy_shared` (`SHARED_PROXY_NETWORK`), the Docker network the deploy puts both stacks on; on production that is `nginx-proxy`, which `compose-compose-1` joins.
- **The deploy:** the service is in the compose profile `mcp`, so a bare `docker compose up` leaves it out. `scripts/deploy/deploy_environment.sh` builds and restarts it by name with `store_nginx`. In production, run `docker compose up -d --build neurostore-mcp` from `store/`.
- **nginx** serves two paths:
  - `/mcp`, with buffering off and a 300 s read timeout;
  - `/.well-known/oauth-protected-resource/mcp`, the RFC 9728 metadata.

  claude.ai drops the `Authorization` header across a cross-host redirect, so both are served on the same host.
- **Sessions:** the server is stateless and answers with JSON, not SSE, so any worker can take any request.

## How a sign-in works

1. **Reads stay anonymous.** Without a token, the server passes a request straight to the MCP app. A `tools/call` of a tool that needs a user is the exception: it gets HTTP 401 with `WWW-Authenticate: Bearer resource_metadata=".../.well-known/oauth-protected-resource/mcp"` (`auth.LazyAuth`).
   - ChatGPT ignores that 401: it signs in only when a tool result is `isError` with `_meta["mcp/www_authenticate"]` (OpenAI Apps SDK, "Triggering authentication UI"). Claude is the reverse: it ignores a 200. Neither names itself reliably, so a call whose `_meta` has ChatGPT's `openai/` keys gets that tool result, and every other call the 401 (or 403).
   - Each tool also declares `_meta.securitySchemes` for ChatGPT: `noauth` for anonymous reads, `oauth2` with `read` (sign-in reads) or `read write` (writes).
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
- The post-login Action "Neurostore user name" (id `002a0e09-ef29-4f8a-ba2e-c8e08ab44d72`) is deployed and in the Login flow. A device-code token for the agents API through "Neurostore agents" carries `https://neurostore.org/name`.
- Allow Skipping User Consent is on for the agents API. A real exchange on the production host, from a `read write` sign-in for the MCP API through "Neurostore agents", gave an agents token with the user's `sub`, `act.sub` = the server's client, scope `read write`, and the name claim.

Auth0's MCP server can't do steps 2 and 3 (no tenant-settings tool; its app and grant tools can't set `app_type: resource_server` or `token_exchange`), so they were done in the dashboard.

**Staging** (`neurosynth-staging.us.auth0.com`, 2026-11-17): steps 1–4 done.
- Step 1: the API "Neurostore MCP (staging)", `https://staging.neurostore.xyz/mcp` (id `6afc99299706952d0484b1cc`), set up like production's.
  - The tenant is at its API limit, so Auth0 couldn't add the usual auto-created test app and showed an error, but the API was created.
- Step 2: both settings on.
- Step 3: "Neurostore MCP server (staging)" (client id `kLBZbOywoE6D9rGcX7FwxU6sjo9cXnel`), On-Behalf-Of on. The agents API is `https://staging.neurostore.xyz/agents/`, user policy `allow_all`. To make room, "Auth0 Management API (Test Application)" was deleted; no deploy env used it.
- Step 4: users sign in with `neurosynth-cli`, which already allows the claude.ai and port-33418 callbacks. A device-code request for the MCP API through it succeeds.
- The post-login Action "Neurostore user name" (id `36a409cd-9a57-425d-aa95-dcee08308e8a`) is deployed and in the Login flow; exchanged agents tokens carry `https://neurostore.org/name`.
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
   - Or let clients register themselves with Client ID Metadata Documents (CIMD): Settings → Advanced → "Client ID Metadata Document (CIMD) Registration" and "Dynamic CIMD Registration" (early access, under Okta's free-trial terms) on. Leave DCR off.
     - A client registered this way is a third-party app (e.g. `tpc_…` for Claude Code, from `https://claude.ai/oauth/claude-code-client-metadata`). Third-party apps get no access to an API until it is granted, so on the MCP API set **Default Permissions for third-party applications → User-delegated Access** to Authorized, `read` and `write` (Client Access stays Unauthorized). Without it `/authorize` fails with "Client … is not authorized to access resource server".
     - Production, 2026-11-17: both CIMD toggles on, third-party defaults `read write`; Claude Code registered itself. Staging: third-party defaults `read write`, CIMD toggles off.
     - Third-party clients can't use Classic Login ("Third Party clients are not allowed to use the Classic Universal Login experience"), so the tenant must run **New Universal Login** (Branding → Universal Login → Core configuration → Universal Login, and Login → Customize Login Page off). Set the logo there (`https://compose.neurosynth.org/static/synth.png`).
     - Classic's custom Lock page required an "I agree to the terms of service and privacy policy" checkbox on email sign-up. New Universal Login has no such checkbox without a custom domain, so the Form "Neurosynth terms of service" (`mcp/auth0/neurosynth-terms-form.json`, created with the Forms API) and the post-login Action "Neurosynth terms" (`mcp/auth0/neurosynth-terms.js`) ask every user once, on any connection, and record `app_metadata.terms_accepted_at`. The Action skips refresh, token-exchange and password grants, so On-Behalf-Of is unaffected; it sits before "Neurostore user name" in the Login flow. Its `FORM_IDS` maps each tenant to its form.
     - A self-registered client is a *strict third-party* client, and Auth0 adds three more conditions for it: a free application slot (each client program registers once per tenant; a full tenant answers "Unknown client: <metadata URL>"), connections **promoted to domain level** (Authentication → each connection → "Promote Connection to Domain Level"; otherwise "no connections enabled for the client"), and **no enabled legacy Rules** (otherwise "Rules execution is not supported for strict third-party clients").
     - Staging, 2026-11-17: New Universal Login, both CIMD toggles on, Username-Password, GitHub and Google promoted, its one Rule ("Add number of logins to profile", read by nothing) disabled, 7 of 10 apps. Claude Code registered itself, signed in, and created a studyset through the MCP server (On-Behalf-Of exchange, write owned by the user). Terms Form `ap_wMqyMLJTQSVo8MxSKHoJGy` and Action `6fbc410f-0c4c-4b6e-a489-ee9cec5693e8` in the Login flow. Checked with a device sign-in: the Form showed and submitted, the acceptance was saved, and the On-Behalf-Of exchange that followed succeeded with the name claim.
     - ChatGPT's metadata document declares `token_endpoint_auth_method: private_key_jwt`, which the dashboard marks Enterprise; whether a CIMD client may use it on the free plan is untested.
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

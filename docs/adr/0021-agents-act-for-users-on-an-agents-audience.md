# 0021. AI agents act for a user on tokens for a second Auth0 API, with scopes and no roles

Status: accepted, backends built; Auth0 tenants and the MCP server not yet

## Context

AI agents (Claude Code, claude.ai connectors through the MCP server in #1949, scripts) need to call Neurostore and Compose as the person using them, without a pasted bearer token. Both backends accept any Auth0 token for one shared audience (`https://neurostore.org/api/`; staging `https://staging.synth.neurostore.xyz/api/`), from any application in the tenant, and check no scope: a token is the user's full power, `admin` included. The MCP authorization spec (2026-07-28) makes an MCP server a resource server that accepts only tokens for its own URL and never forwards them; Auth0's On-Behalf-Of exchange (GA 2026-05-06) gives it a token for another of our APIs that keeps `sub` and adds `act`. Auth0 access tokens can't be revoked. The research and the candidates are in `docs/agent-auth.md`.

## Decision

A second Auth0 API, the agents API (`https://neurostore.org/agents/`; staging `https://staging.neurostore.xyz/agents/`; `AUTH0_AGENT_AUDIENCE`), with permissions `read` and `write`. Both backends accept its tokens beside the browser's. A token is *delegated* when it is for the agents audience or carries `act`:

- `decode_token` enforces its scope per method, the API keys' rule: `read` for GET/HEAD/OPTIONS, `write` (which includes read) for the rest; anything else is a 403.
- It acts as `sub` with none of the user's database roles: no `admin`, no `admin-reviewer` (`_user_role_names` in Store, `is_user_admin` in Compose).
- It can't create or revoke API keys, so an hour's grant can't become a key that lasts until revoked.
- Each write is logged on `neurostore.agents` / `neurosynth_compose.agents` as `agent write <method> <path> user=<sub> agent=<azp> actor=<act.sub>`.
- A user new to Store is named "Unknown" when the token can't reach `/userinfo`, as Compose already does.

Tokens for the browser's audience without `act` behave as before. Both backends now cache the tenant's JWKS for 10 minutes, refetching for an unknown `kid` at most once a minute, instead of fetching it on every request. An empty `AUTH0_AGENT_AUDIENCE` refuses every agent token.

## Consequences

- Ownership, visibility and the `compose_bot` rules are unchanged: an agent sees and edits what its user could in the browser, minus admin.
- Users consent per application and scope in Auth0; a `read` grant is a read-only agent.
- Revocation is the user's Authorized Applications page or `/oauth/revoke` for refresh tokens, and the agents API's short access-token lifetime (1 h) for the rest.
- Compose forwards a caller's token to Store on some writes; an agent's token is accepted there with the same scopes.
- API keys keep their behaviour: a key of an admin acts as admin.
- Per-agent rate limits are not built. A per-IP limit can't stand in for one, since every claude.ai user arrives from the same Anthropic range.

## Rejected

- **Per-agent machine-to-machine clients:** one Auth0 application and secret per agent, made by an admin, plus a table mapping each client to the user it acts for. There's no user consent, and the tokens spend the monthly M2M quota (1,000 on Free and Essentials). It stays the pattern for services (ns-pond, Compose's bot).
- **API keys alone:** pasted long-lived secrets with no consent screen, which claude.ai's OAuth connectors can't use.
- **Scopes on the browser's audience:** telling agents from the frontend would take an allow-list of first-party client ids, and a client missing from it would silently lose writes.
- **The MCP server forwarding its own token:** the MCP spec forbids it; the server exchanges the token on behalf of the user instead.
- **Per-resource write scopes** (`write:studies`, `write:projects`, …): finer consent, but a route-to-scope map to keep in step with two specs. Coarse scopes match the API keys.

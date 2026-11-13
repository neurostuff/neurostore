# Hosting neurostore-mcp remotely, and OAuth for write tools

Status: design note for review, nothing deployed. Checked against Anthropic's connector docs
and the MCP specification on 2026-11-11.

## 1. Read-only server at `https://neurostore.org/mcp`

claude.ai, Claude Desktop and mobile add a remote server as a *custom connector*: they take an
HTTPS URL. The v1 server needs no authentication, and Claude supports that: its connector docs
list "No authentication (authless server)" as supported by default.

**Container.** Add one service to `store/docker-compose.yml`:

```yaml
neurostore-mcp:
  image: ghcr.io/neurostuff/neurostore-mcp:${IMAGE_TAG}
  command: neurostore-mcp --transport http --host 0.0.0.0 --port 8000 --path /mcp
  environment:
    NEUROSTORE_API_URL: http://neurostore:8000/api   # internal: skip the public proxy
    COMPOSE_API_URL: https://compose.neurosynth.org/api
  restart: unless-stopped
```

The image needs a short Dockerfile (`pip install ./mcp`), built and pushed in CI alongside the
other images.

Point `NEUROSTORE_API_URL` at the internal upstream, not `https://neurostore.org/api`. All MCP
traffic leaves from one container, so nginx's per-client `public_query` limit on
`/api/query/` (1 request a second, burst 20) would throttle every agent at once. Rate-limit
per client at `/mcp` instead.

**nginx** (`store/nginx/nginx.conf`). Streamable HTTP is POST plus an optional SSE response
stream, so turn buffering off and allow long reads:

```nginx
location /mcp {
    limit_req zone=mcp burst=30 nodelay;      # new zone, keyed on $binary_remote_addr
    proxy_pass http://neurostore-mcp:8000;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $http_host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $forwarded_proto;
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 300s;
}
```

**What Claude needs from the host:**
- **Reachability.** Claude connects from `160.79.104.0/21`. It needs a public IPv4 A record
  (neurostore.org has one: 128.83.17.134), and it drops the `Authorization` header across
  cross-host redirects. Serve `/mcp` directly, with no redirect to another host.
- **Result size.** claude.ai caps a tool result at about 150,000 characters, and a tool call
  times out after 240 s. The tools' page sizes already stay far below that.
- **Scaling.** One worker keeps MCP sessions in memory. To run several replicas behind nginx,
  enable FastMCP's stateless HTTP mode (`FASTMCP_STATELESS_HTTP=true`). Otherwise use sticky routing on
  the `Mcp-Session-Id` header.

**Adding it in Claude:** Settings → Connectors → Add custom connector, URL
`https://neurostore.org/mcp`, no OAuth settings. On Team and Enterprise plans an owner adds it
once for the organization.

## 2. OAuth for write tools (later)

Write tools (create a studyset, annotate, start a meta-analysis) act as the signed-in user. The
MCP authorization spec makes the MCP server an **OAuth 2.0 resource server**. Auth0
(`https://neurosynth.us.auth0.com/`) stays the authorization server. The MCP server never
handles passwords and never issues tokens.

### 2.1 What the MCP server serves

1. **Protected Resource Metadata (RFC 9728)** at
   `https://neurostore.org/.well-known/oauth-protected-resource/mcp`:

   ```json
   {
     "resource": "https://neurostore.org/mcp",
     "authorization_servers": ["https://neurosynth.us.auth0.com/"],
     "scopes_supported": ["openid", "offline_access", "write:studysets", "write:annotations", "write:projects"],
     "bearer_methods_supported": ["header"],
     "resource_name": "Neurostore MCP"
   }
   ```

   - `resource` must equal the URL the user types into Claude, path included.
   - Claude reads only the first `authorization_servers` entry.
   - nginx must route this path-suffixed well-known URL to the MCP container.

2. **A challenge on unauthenticated requests.** A request without a valid token to a protected
   operation gets `401` with
   `WWW-Authenticate: Bearer resource_metadata="https://neurostore.org/.well-known/oauth-protected-resource/mcp"`.
   Claude ignores that header on a 200.

3. **Token validation** on every request:
   - an RS256 signature against Auth0's JWKS;
   - `iss` = `https://neurosynth.us.auth0.com/`;
   - `aud` = `https://neurostore.org/mcp`;
   - expiry, and the scope each tool needs.

FastMCP already does all three. `fastmcp.server.auth.providers.auth0.Auth0MCPProvider(config_url=…/.well-known/openid-configuration, base_url="https://neurostore.org")`
serves the metadata, sends the challenge and binds the verifier's audience to the resource URL.

**Lazy authentication:**
- Keep the read tools open and require a token only on write tools, using FastMCP's per-tool
  `auth=` checks.
- Users who only read never see a sign-in, and Claude supports a connector whose tools mix
  open and protected.
- Claude's docs describe this mixed mode. Still, try it in claude.ai with one protected tool
  before building on it.

### 2.2 Audience, and calling the Neurostore and Compose APIs

Claude sends the RFC 8707 `resource` parameter (`https://neurostore.org/mcp`) on the
authorization and token requests. The MCP spec requires clients to send it. Auth0 ignores
`resource` unless the tenant enables its **Resource Parameter Compatibility Profile**. With the
profile on, Auth0 treats `resource` as `audience`. So:

- A new Auth0 API is needed, with identifier `https://neurostore.org/mcp` and the write scopes.
- The tokens Claude obtains have `aud = https://neurostore.org/mcp`, not the backends'
  `https://neurostore.org/api/`.

The MCP spec forbids passing a token through to an upstream API it wasn't issued for. The MCP
server therefore needs its own token for the user when it calls Neurostore or Compose. Two
options:

- **Token exchange (preferred).** The MCP server exchanges the user's MCP token for one with
  `aud = https://neurostore.org/api/`, using Auth0 Custom Token Exchange (RFC 8693). The
  backends stay unchanged and each audience means one thing. It needs an Auth0 Action to
  validate the incoming token, and the feature's availability on our plan has to be checked.
- **Backends accept the MCP audience.** Neurostore and Compose add `https://neurostore.org/mcp`
  to the audiences they accept, and the MCP server forwards the token. It is simpler, but it is
  a deliberate trust decision: any token minted for the MCP server is also good on the API.
  Use it only if token exchange is unavailable.

Compose's `Compose-Upload-Key` (a meta-analysis's `run_key`) stays out of MCP. It authorizes
uploading results for one meta-analysis and is not a user credential.

### 2.3 How Claude registers as an OAuth client

Claude's connector docs list three ways, chosen per connector in the Add custom connector
dialog (under **Advanced**):

| Method | What Claude does | What Auth0 needs | Notes |
| --- | --- | --- | --- |
| **CIMD** (Client ID Metadata Document): "Use Claude's published identity" | Uses an HTTPS URL as its `client_id`; Auth0 fetches Claude's metadata from it | "Client ID Metadata Document Registration" enabled; discovery must advertise `client_id_metadata_document_supported: true` and `none` in `token_endpoint_auth_methods_supported` | Anthropic's recommended option, and a SHOULD in the latest MCP spec. Auth0's dynamic CIMD is early access; CIMD clients are third-party and fail if the tenant still has active Rules |
| **DCR** (RFC 7591): "Register automatically" | POSTs to Auth0's `registration_endpoint`, creating a new client on each fresh connection | Dynamic Client Registration enabled (off by default) | The latest MCP spec calls DCR deprecated. It fills the tenant with clients and needs third-party-client connection settings |
| **Pre-registered client**: "Use your own OAuth client" | Uses a client ID (and, for a confidential client, a secret) the user pastes in | One Auth0 application with the callbacks below | Works with no tenant-wide changes; each user must paste the client ID once |

Today's production tenant advertises no `registration_endpoint` and no
`client_id_metadata_document_supported` (checked 2026-11-11). Only the pre-registered path
works without changing tenant settings.

**Callback URLs** to allow on whichever Auth0 application is used:
- Hosted Claude apps: exactly `https://claude.ai/api/mcp/auth_callback`.
- Claude Code: loopback `http://localhost:<port>/callback` and `http://127.0.0.1:<port>/callback`.
  Run it with a fixed port (`claude mcp add --callback-port …`) when the client is pre-registered.

Every authorization request must use PKCE S256, which Auth0 supports.

**Recommended order:**
1. Ship the read-only server (section 1).
2. For the first write tools, create one public ("SPA/native", no secret) Auth0 application for
   MCP clients, with the callbacks above. Users paste its client ID under "Use your own OAuth
   client".
3. Enable CIMD once Auth0's dynamic CIMD is generally available on our plan. Then users add the
   connector with no client ID. Leave DCR off.

### 2.4 Auth0 changes this needs (none made yet; each needs James's approval)

- A new API, identifier `https://neurostore.org/mcp`, with the write scopes.
- The Resource Parameter Compatibility Profile, and "Include Issuer in Authorization
  Responses", under Settings → Advanced.
- A public application for MCP clients, with the callback URLs above. Later, CIMD registration.
- Custom Token Exchange and its Action, if section 2.2's preferred option is chosen.

## Sources

- Anthropic, *Building connectors: authentication*: https://claude.com/docs/connectors/building/authentication.md
- Anthropic, *Building connectors*: https://claude.com/docs/connectors/building.md
- MCP specification, *Authorization*: https://modelcontextprotocol.io/specification/latest/basic/authorization
- Auth0, *Resource Parameter Compatibility Profile*: https://auth0.com/ai/docs/mcp/guides/resource-param-compatibility-profile
- Auth0, *Register applications with CIMD*: https://auth0.com/docs/get-started/auth0-overview/create-applications/register-applications-with-cimd
- Auth0, *Dynamic Client Registration for MCP*: https://auth0.com/ai/docs/mcp/guides/registering-your-mcp-client-application/dynamic-client-registration

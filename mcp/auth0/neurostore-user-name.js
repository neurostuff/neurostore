/**
 * Neurostore user name: put the user's display name on tokens for the agents API.
 *
 * Store and Compose name a user they haven't seen from Auth0's /userinfo. A token from the
 * MCP server's on-behalf-of exchange can't be used there (the exchange refuses `openid`),
 * so they read this claim instead (NAME_CLAIM in each backend's resources/auth.py).
 * The name is the one the backends would pick: `name`, or `nickname` when `name` is an email.
 * It never blocks a login.
 */
const AGENTS = ["https://neurostore.org/agents/", "https://staging.neurostore.xyz/agents/"];
const NAME_CLAIM = "https://neurostore.org/name";

exports.onExecutePostLogin = async (event, api) => {
  try {
    const audience = event.resource_server && event.resource_server.identifier;
    if (!AGENTS.includes(audience)) return;
    const user = event.user || {};
    const name = user.name && !user.name.includes("@") ? user.name : user.nickname;
    if (name) api.accessToken.setCustomClaim(NAME_CLAIM, name);
  } catch (err) {
    console.log("neurostore user name skipped:", err && err.message);
  }
};

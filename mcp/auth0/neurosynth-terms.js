/**
 * Neurosynth terms: ask each user once to accept the terms of service.
 *
 * Classic Login's Lock page had a required "I agree to the terms of service and privacy
 * policy" checkbox on email sign-up. New Universal Login has none without a custom domain,
 * so this shows the tenant's "Neurosynth terms of service" Form (a required Legal field) on
 * the first interactive login of anyone who hasn't accepted, whatever the connection, and
 * records the time in app_metadata.terms_accepted_at.
 *
 * Logins that can't show a page (refresh, token exchange, password grants) are left alone.
 */
const FORM_IDS = {
  neurosynth: "ap_tMir1bdqYVjFvrtyzgniFR",
  "neurosynth-staging": "ap_wMqyMLJTQSVo8MxSKHoJGy",
};
const NO_PAGE = new Set([
  "oauth2-refresh-token",
  "oauth2-token-exchange",
  "oauth2-resource-owner",
  "oauth2-password",
  "oauth2-resource-owner-jwt-bearer",
]);

exports.onExecutePostLogin = async (event, api) => {
  if ((event.user.app_metadata || {}).terms_accepted_at) return;
  if (NO_PAGE.has(event.transaction && event.transaction.protocol)) return;
  const form = FORM_IDS[event.tenant && event.tenant.id];
  if (!form) return;
  api.prompt.render(form);
};

exports.onContinuePostLogin = async (event, api) => {
  if (event.prompt && event.prompt.fields && event.prompt.fields.terms === true) {
    api.user.setAppMetadata("terms_accepted_at", new Date().toISOString());
    return;
  }
  api.access.deny("Accepting the terms of service is required to sign in.");
};

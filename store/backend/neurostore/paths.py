API_BASE_PATH = "/api"
#: The spec paths of /review; a request URL carries them under API_BASE_PATH.
REVIEW_PATH_PREFIX = "/review/"
REVIEW_URL_PREFIX = f"{API_BASE_PATH}{REVIEW_PATH_PREFIX}"
UPLOAD_URL_PREFIX = f"{REVIEW_URL_PREFIX}imports/"
#: Outreach's API, mounted beside Connexion's and outside the OpenAPI spec.
OUTREACH_URL_PREFIX = f"{API_BASE_PATH}/outreach"
#: The author's page's API, public and outside the spec too.
SHARE_URL_PREFIX = f"{API_BASE_PATH}/share"


def is_review_path(path: str) -> bool:
    return path.startswith(REVIEW_URL_PREFIX)

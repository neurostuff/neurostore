from urllib.parse import urljoin

from requests import Session


class LiveServerSession(Session):
    def __init__(self, prefix_url):
        self.prefix_url = prefix_url
        super(LiveServerSession, self).__init__()

    def request(self, method, url, *args, **kwargs):
        url = urljoin(self.prefix_url, url)
        return super(LiveServerSession, self).request(method, url, *args, **kwargs)


def neurostore_session(access_token, neurostore_api_url):
    ns_ses = LiveServerSession(prefix_url=neurostore_api_url)

    auth = {"Authorization": access_token}
    ns_ses.headers.update(auth)

    return ns_ses

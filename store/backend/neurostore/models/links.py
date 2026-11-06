"""The links a paper gives, and the domains that put a link in a category.

Stored, not served: no schema or endpoint names these tables
(docs/adr/0017-paper-links-and-licences.md).
"""

from urllib.parse import urlsplit

import sqlalchemy as sa
import tldextract

from neurostore.database import db
from neurostore.models.data import BaseMixin

LINK_SOURCES = ("pipeline", "user")
LINK_DOMAIN_KINDS = (
    "data_repository",
    "code",
    "preprint",
    "publisher",
    "doi_prefix",
    "other",
)
DOI_RESOLVER = "doi.org"
DOI_URL_PREFIX = f"https://{DOI_RESOLVER}/"

# The public suffix list snapshot tldextract ships; never fetched.
_extract = tldextract.TLDExtract(suffix_list_urls=(), cache_dir=None)


def link_host(url):
    """The host of ``url``, lower case."""
    return urlsplit(url).hostname


def registrable_domain(host):
    """The domain under ``host``'s public suffix (``osf.io`` for ``files.osf.io``); the
    host itself when it has none, such as an IP address or ``localhost``."""
    return _extract(host).top_domain_under_public_suffix or host


class BaseStudyLink(BaseMixin, db.Model):
    """One http(s) link a paper gives, as the producer normalized it."""

    __tablename__ = "base_study_links"

    base_study_id = db.Column(
        db.Text,
        db.ForeignKey("base_studies.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    url = db.Column(db.Text, nullable=False)
    host = db.Column(db.Text, nullable=False, index=True)
    registrable_domain = db.Column(db.Text, nullable=False, index=True)
    # NULL until the repository the link names was checked.
    has_nifti = db.Column(db.Boolean, nullable=True)
    source = db.Column(db.Text, nullable=False)

    __table_args__ = (
        sa.UniqueConstraint("base_study_id", "url", name="uq_base_study_links_base_study_url"),
        sa.CheckConstraint(
            sa.column("source").in_(LINK_SOURCES), name="ck_base_study_links_source"
        ),
    )

    @classmethod
    def of(cls, base_study_id, url, source, has_nifti=None):
        host = link_host(url)
        return cls(
            base_study_id=base_study_id,
            url=url,
            host=host,
            registrable_domain=registrable_domain(host),
            has_nifti=has_nifti,
            source=source,
        )


class LinkDomain(db.Model):
    """What a link's domain is: a registrable domain or host, or, for a link to
    doi.org, a DOI prefix (see ``matches``)."""

    __tablename__ = "link_domains"

    pattern = db.Column(db.Text, primary_key=True)
    repository = db.Column(db.Text, nullable=False)
    kind = db.Column(db.Text, nullable=False)

    __table_args__ = (
        sa.CheckConstraint(
            sa.column("kind").in_(LINK_DOMAIN_KINDS), name="ck_link_domains_kind"
        ),
    )

    @staticmethod
    def matches(link=BaseStudyLink, domain=None):
        """The join condition of a link and the link domains it falls under: the row of
        its host or registrable domain, and, for a doi.org link, the row of each prefix
        of its DOI that ends where the DOI's next part starts (``/`` or ``.``)."""
        domain = LinkDomain if domain is None else domain
        doi = sa.func.substr(link.url, len(DOI_URL_PREFIX) + 1)
        return sa.or_(
            domain.pattern.in_([link.host, link.registrable_domain]),
            sa.and_(
                link.host == DOI_RESOLVER,
                sa.or_(
                    doi == domain.pattern,
                    sa.func.starts_with(doi, domain.pattern + "/"),
                    sa.func.starts_with(doi, domain.pattern + "."),
                ),
            ),
        )

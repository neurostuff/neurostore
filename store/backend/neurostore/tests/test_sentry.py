"""Tests for Sentry error reporting (issue #1572)."""

import neurostore.observability.sentry as sentry


def _reset():
    sentry._initialized = False


def test_disabled_without_dsn():
    _reset()
    assert sentry.configure_sentry({"ENV": "production"}) is False
    assert sentry.is_enabled() is False
    # capture is a no-op rather than an error when Sentry never started
    assert sentry.capture_exception(RuntimeError("boom")) is None


def test_enabled_with_dsn(monkeypatch):
    _reset()
    captured = {}

    def fake_init(**kwargs):
        captured.update(kwargs)

    import sentry_sdk

    monkeypatch.setattr(sentry_sdk, "init", fake_init)
    monkeypatch.setattr(sentry_sdk, "set_tag", lambda *a, **k: None)

    enabled = sentry.configure_sentry(
        {
            "ENV": "staging",
            "SENTRY_DSN": "https://key@example.ingest.sentry.io/1",
            "SENTRY_TRACES_SAMPLE_RATE": "0.25",
            "SENTRY_RELEASE": "v1.2.3",
        },
        component="test",
    )
    _reset()

    assert enabled is True
    assert captured["environment"] == "staging"
    assert captured["release"] == "v1.2.3"
    assert captured["traces_sample_rate"] == 0.25
    # study payloads must not be shipped to a third party
    assert captured["send_default_pii"] is False


def test_sample_rate_is_clamped_and_tolerates_junk():
    assert sentry._sample_rate({"R": "2.5"}, "R") == 1.0
    assert sentry._sample_rate({"R": "-1"}, "R") == 0.0
    assert sentry._sample_rate({"R": "not-a-number"}, "R") == 0.0
    assert sentry._sample_rate({}, "R", 0.1) == 0.1


def test_request_context_skips_missing_fields():
    assert sentry.request_context(None) == {}

    class Request:
        method = "GET"
        url = "http://example.test/api/studies"
        query_params = "search=memory"

    assert sentry.request_context(Request()) == {
        "method": "GET",
        "url": "http://example.test/api/studies",
        "query_string": "search=memory",
    }


def test_component_tag_identifies_the_process(monkeypatch):
    """Every process shares one DSN, so the component tag is what tells them apart."""
    _reset()
    captured = {}
    import sentry_sdk

    monkeypatch.setattr(sentry_sdk, "init", lambda **kw: None)
    monkeypatch.setattr(sentry_sdk, "set_tag", lambda k, v: captured.__setitem__(k, v))

    sentry.configure_sentry(
        {"ENV": "production", "SENTRY_DSN": "https://k@example.ingest.sentry.io/1"},
        component="a-worker",
    )
    _reset()
    assert captured["component"] == "a-worker"


def test_sentry_component_env_overrides_the_caller(monkeypatch):
    """docker-compose names each container; the caller's value is only a fallback."""
    _reset()
    captured = {}
    import sentry_sdk

    monkeypatch.setattr(sentry_sdk, "init", lambda **kw: None)
    monkeypatch.setattr(sentry_sdk, "set_tag", lambda k, v: captured.__setitem__(k, v))

    sentry.configure_sentry(
        {
            "ENV": "production",
            "SENTRY_DSN": "https://k@example.ingest.sentry.io/1",
            "SENTRY_COMPONENT": "neurostore-release-worker",
        },
        component="neurostore",
    )
    _reset()
    assert captured["component"] == "neurostore-release-worker"

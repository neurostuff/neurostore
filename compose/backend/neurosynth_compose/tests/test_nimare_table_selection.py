from pathlib import Path

from neurosynth_compose.resources.analysis import (
    NIMARE_TABLE_FILENAME_PATTERNS,
    _expected_cluster_table_targets,
    select_cluster_table_for_specification,
)


def test_nimare_table_filename_patterns_are_documented():
    assert NIMARE_TABLE_FILENAME_PATTERNS["cluster"] == "<target_image>_tab-clust.tsv"
    assert (
        "<target_image>_diag-<FocusCounter|Jackknife>_tab-counts.tsv"
        in NIMARE_TABLE_FILENAME_PATTERNS["diagnostic"]
    )


def test_expected_cluster_targets_fdr_from_spec():
    specification = {
        "estimator": {"type": "ALE"},
        "corrector": {"type": "FDRCorrector", "args": {"method": "indep"}},
    }

    assert _expected_cluster_table_targets(specification) == [
        "z_corr-FDR_method-indep"
    ]


def test_expected_cluster_targets_fwe_montecarlo_prioritizes_mass():
    specification = {
        "estimator": {"type": "ALE"},
        "corrector": {"type": "FWECorrector", "args": {"method": "montecarlo"}},
    }

    assert _expected_cluster_table_targets(specification)[:2] == [
        "z_desc-mass_level-cluster_corr-FWE_method-montecarlo",
        "z_desc-size_level-cluster_corr-FWE_method-montecarlo",
    ]


def test_select_cluster_table_prefers_spec_matched_file_not_upload_order():
    specification = {
        "estimator": {"type": "ALE"},
        "corrector": {"type": "FDR", "args": {"method": "indep"}},
    }
    cluster_table_fnames = [
        Path("/tmp/z_desc-size_level-cluster_corr-FWE_method-montecarlo_tab-clust.tsv"),
        Path("/tmp/z_corr-FDR_method-indep_tab-clust.tsv"),
    ]

    selected = select_cluster_table_for_specification(
        cluster_table_fnames,
        specification,
    )

    assert selected == Path("/tmp/z_corr-FDR_method-indep_tab-clust.tsv")


def test_select_cluster_table_returns_none_when_expected_missing():
    specification = {
        "estimator": {"type": "ALE"},
        "corrector": {"type": "FDR", "args": {"method": "indep"}},
    }
    cluster_table_fnames = [
        Path("/tmp/z_desc-mass_level-cluster_corr-FWE_method-montecarlo_tab-clust.tsv"),
    ]

    assert (
        select_cluster_table_for_specification(cluster_table_fnames, specification)
        is None
    )


def test_select_cluster_table_prefers_corrected_by_default():
    cluster_table_fnames = [
        Path("/tmp/z_tab-clust.tsv"),
        Path("/tmp/z_corr-FDR_method-indep_tab-clust.tsv"),
    ]

    selected = select_cluster_table_for_specification(
        cluster_table_fnames,
        specification=None,
    )

    assert selected == Path("/tmp/z_corr-FDR_method-indep_tab-clust.tsv")


def test_select_cluster_table_returns_none_when_only_uncorrected_available():
    cluster_table_fnames = [Path("/tmp/z_tab-clust.tsv")]

    assert (
        select_cluster_table_for_specification(
            cluster_table_fnames,
            specification=None,
        )
        is None
    )


def test_select_cluster_table_uses_uncorrected_when_spec_has_no_corrector():
    specification = {
        "estimator": {"type": "ALE"},
        "corrector": None,
    }
    cluster_table_fnames = [
        Path("/tmp/z_corr-FDR_method-indep_tab-clust.tsv"),
        Path("/tmp/z_tab-clust.tsv"),
    ]

    selected = select_cluster_table_for_specification(
        cluster_table_fnames,
        specification,
    )

    assert selected == Path("/tmp/z_tab-clust.tsv")


def test_select_cluster_table_returns_none_if_spec_has_no_corrector_but_no_uncorrected():
    specification = {
        "estimator": {"type": "ALE"},
        "corrector": None,
    }
    cluster_table_fnames = [Path("/tmp/z_corr-FDR_method-indep_tab-clust.tsv")]

    assert (
        select_cluster_table_for_specification(
            cluster_table_fnames,
            specification,
        )
        is None
    )


def test_select_cluster_table_prefers_fwe_mass_over_size_for_ale_subtraction():
    specification = {
        "estimator": {"type": "ALESubtraction"},
        "corrector": {"type": "FWECorrector", "args": {"method": "montecarlo"}},
    }
    cluster_table_fnames = [
        Path(
            "/tmp/z_desc-group1MinusGroup2Size_level-cluster_corr-FWE_"
            "method-montecarlo_tab-clust.tsv"
        ),
        Path(
            "/tmp/z_desc-group1MinusGroup2Mass_level-cluster_corr-FWE_"
            "method-montecarlo_tab-clust.tsv"
        ),
    ]

    selected = select_cluster_table_for_specification(
        cluster_table_fnames,
        specification,
    )

    assert (
        selected
        == Path(
            "/tmp/z_desc-group1MinusGroup2Mass_level-cluster_corr-FWE_"
            "method-montecarlo_tab-clust.tsv"
        )
    )

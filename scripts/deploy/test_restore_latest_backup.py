from __future__ import annotations

import subprocess
from unittest.mock import patch

import restore_latest_backup


def test_latest_s3_key_limits_unprefixed_lookup_to_bucket_root() -> None:
    completed = subprocess.CompletedProcess(
        args=[],
        returncode=0,
        stdout="04-20-2026-at-00-00-01_neurostore.dump\n",
    )

    with patch.object(restore_latest_backup, "resolve_aws_cli", return_value="aws"), patch(
        "subprocess.run", return_value=completed
    ) as run:
        assert (
            restore_latest_backup.latest_s3_key("neurostore-backup")
            == "04-20-2026-at-00-00-01_neurostore.dump"
        )

    command = run.call_args.args[0]
    assert "--delimiter" in command
    assert "/" == command[command.index("--delimiter") + 1]
    assert "--prefix" not in command


def test_latest_s3_key_keeps_explicit_prefix_for_dev_reduced_dumps() -> None:
    completed = subprocess.CompletedProcess(
        args=[],
        returncode=0,
        stdout="dev-reduced/05-12-2026-at-00-00-01_neurostore_dev-reduced.dump\n",
    )

    with patch.object(restore_latest_backup, "resolve_aws_cli", return_value="aws"), patch(
        "subprocess.run", return_value=completed
    ) as run:
        assert restore_latest_backup.latest_s3_key(
            "neurostore-backup", "dev-reduced"
        ) == "dev-reduced/05-12-2026-at-00-00-01_neurostore_dev-reduced.dump"

    command = run.call_args.args[0]
    assert command[command.index("--prefix") + 1] == "dev-reduced/"
    assert command[command.index("--delimiter") + 1] == "/"

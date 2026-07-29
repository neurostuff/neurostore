from __future__ import annotations

import subprocess
from pathlib import Path
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


def test_local_dump_path_bypasses_s3_lookup(tmp_path: Path) -> None:
    dump_path = tmp_path / "snapshot.dump"
    dump_path.write_bytes(b"dump")

    with patch.object(restore_latest_backup, "recreate_database") as recreate, patch.object(
        restore_latest_backup, "restore_dump"
    ) as restore, patch.object(restore_latest_backup, "latest_s3_key") as latest:
        with patch(
            "sys.argv",
            [
                "restore_latest_backup.py",
                "--compose-dir",
                ".",
                "--dump-path",
                str(dump_path),
                "--container",
                "pgsql",
                "--database",
                "app_db",
            ],
        ):
            assert restore_latest_backup.main() == 0

    latest.assert_not_called()
    recreate.assert_called_once()
    restore.assert_called_once()

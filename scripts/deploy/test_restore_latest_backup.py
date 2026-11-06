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


def run_template_restore(tmp_path: Path, templates: dict[str, bool], *extra: str):
    dump_path = tmp_path / "11-06-2026-at-00-00-01_neurostore.dump"
    dump_path.write_bytes(b"dump")
    statements: list[tuple[str, str]] = []

    def record(compose_dir, project_name, container, database, sql, **kwargs):
        statements.append((database, sql))

    with patch.object(restore_latest_backup, "psql", side_effect=record), patch.object(
        restore_latest_backup, "template_databases", return_value=templates
    ), patch.object(restore_latest_backup, "restore_dump") as restore, patch(
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
            "neurostore",
            "--template",
            *extra,
        ],
    ):
        assert restore_latest_backup.main() == 0

    final = restore_latest_backup.template_name("neurostore", f"local:{dump_path.name}")
    return final, [sql for _, sql in statements], restore


def test_complete_template_is_cloned_without_restoring(tmp_path: Path) -> None:
    final = restore_latest_backup.template_name(
        "neurostore", "local:11-06-2026-at-00-00-01_neurostore.dump"
    )
    _, statements, restore = run_template_restore(tmp_path, {final: True})

    restore.assert_not_called()
    assert statements == [
        "DROP DATABASE IF EXISTS neurostore WITH (FORCE);",
        f"CREATE DATABASE neurostore TEMPLATE {final} STRATEGY FILE_COPY;",
    ]


def test_new_backup_replaces_other_templates_and_renames_last(tmp_path: Path) -> None:
    stale = {"neurostore_tpl_0123456789ab": True, "neurostore_tpl_restoring": True}
    final, statements, restore = run_template_restore(tmp_path, stale)

    for name in stale:
        drop = statements.index(f"DROP DATABASE IF EXISTS {name} WITH (FORCE);")
        assert statements[drop - 1] == f"ALTER DATABASE {name} WITH IS_TEMPLATE false;"
    assert restore.call_args.args[3] == "neurostore_tpl_restoring"
    freeze = statements.index(
        "ALTER DATABASE neurostore_tpl_restoring WITH IS_TEMPLATE true ALLOW_CONNECTIONS false;"
    )
    rename = statements.index(f"ALTER DATABASE neurostore_tpl_restoring RENAME TO {final};")
    assert freeze < rename
    assert statements[rename + 1 :] == [
        "DROP DATABASE IF EXISTS neurostore WITH (FORCE);",
        f"CREATE DATABASE neurostore TEMPLATE {final} STRATEGY FILE_COPY;",
    ]


def test_incomplete_template_under_final_name_is_restored_again(tmp_path: Path) -> None:
    final = restore_latest_backup.template_name(
        "neurostore", "local:11-06-2026-at-00-00-01_neurostore.dump"
    )
    _, statements, restore = run_template_restore(tmp_path, {final: False})

    restore.assert_called_once()
    assert f"DROP DATABASE IF EXISTS {final} WITH (FORCE);" in statements


def test_template_only_leaves_the_database_alone(tmp_path: Path) -> None:
    _, statements, _ = run_template_restore(tmp_path, {}, "--template-only")

    assert not any("DATABASE neurostore " in sql for sql in statements)

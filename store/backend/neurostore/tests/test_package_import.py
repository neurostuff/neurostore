import subprocess
import sys


def test_importing_the_package_does_not_import_ingest():
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import neurostore, sys; assert 'neurostore.ingest' not in sys.modules",
        ],
        capture_output=True,
        text=True,
        timeout=120,
    )

    assert result.returncode == 0, result.stderr

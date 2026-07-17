"""Import-light console entrypoint for the NeuroStore CLI."""

import importlib.util
from pathlib import Path


def _load_main():
    cli_path = Path(__file__).parent / "neurostore" / "cli.py"
    spec = importlib.util.spec_from_file_location("_neurostore_cli_impl", cli_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.main


main = _load_main()


if __name__ == "__main__":
    main()


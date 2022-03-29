import json
from pathlib import Path

from docstring_parser.numpydoc import NumpydocParser
import nimare.meta.cbma as nicoords
import nimare.meta.kernel as nikern
import nimare
NIMARE_COORDINATE_ALGORITHMS = [
    "MKDADensity",
    "KDA",
    "MKDAChi2",
    "ALE",
    "ALESubtraction",
    "SCALE",
]

NIMARE_KERNELS = [
    "ALEKernel",
    "KDAKernel",
    "MKDAKernel",
]

DEFAULT_KERNELS = {
    "MKDADensity": "MKDAKernel",
    "MKDAChi2": "MKDAKernel",
    "KDA": "KDAKernel",
    "ALE": "ALEKernel",
    "ALESubtraction": "ALEKernel",
    "SCALE": "ALEKernel",
}

BLACKLIST_PARAMS = [
    "n_cores",
    "memory_limit",
    "null_distributions_",
    "inputs_",
    "masker",
    "kernel_transformer",
]

numparse = NumpydocParser()
config = {
    "VERSION": nimare.__version__,
    "CBMA": {},
    "IBMA": {},
}

for algo in NIMARE_COORDINATE_ALGORITHMS:
    func = getattr(nicoords, algo)
    docs = numparse.parse(func.__doc__)

    config["CBMA"][algo] = {
        "parameters": {
            param.arg_name: {
                "description": param.description,
                "type": param.type_name,
            } for param in docs.params if param.arg_name not in BLACKLIST_PARAMS
        }
    }

    kern_func = getattr(nikern, DEFAULT_KERNELS[algo])
    kern_docs = numparse.parse(kern_func.__doc__)
    config["CBMA"][algo]['parameters'].update(
        {
            "kernel__" + param.arg_name: {
                "description": param.description,
                "type": param.type_name,
            } for param in kern_docs.params if param.arg_name not in BLACKLIST_PARAMS
        }
    )

# save config file
fname = Path(__file__).parent.parent / "src" / "assets" / "config" / "meta_analysis_params.json"

with open(fname, "w+") as c:
    json.dump(config, c, indent=4)

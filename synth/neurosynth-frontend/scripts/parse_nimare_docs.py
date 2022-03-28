import json
from pathlib import Path

from docstring_parser.numpydoc import NumpydocParser
import nimare.meta.cbma as nicoords
import nimare.meta.kernel as nikern
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

numparse = NumpydocParser()
config = {
    "CBMA": {},
    "IBMA": {},
    "Kernel": {},
}

for algo in NIMARE_COORDINATE_ALGORITHMS:
    func = getattr(nicoords, algo)
    docs = numparse.parse(func.__doc__)
    config["CBMA"][algo] = {
        "parameters": {
            param.arg_name: {
                "description": param.description,
                "type": param.type_name,
            } for param in docs.params if param.arg_name != '**kwargs'
        }
    }

for kern in NIMARE_KERNELS:
    func = getattr(nikern, kern)
    docs = numparse.parse(func.__doc__)
    config["Kernel"][kern] = {
        "parameters": {
            param.arg_name: {
                "description": param.description,
                "type": param.type_name,
            } for param in docs.params if param.arg_name != '**kwargs'
        }
    }

# save config file
fname = Path(__file__).parent.parent / "src" / "assets" / "config" / "config_auto.json"

with open(fname, "w+") as c:
    json.dump(config, c, indent=4)

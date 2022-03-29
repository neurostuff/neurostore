import inspect
import json
from pathlib import Path
import re


from numpydoc.docscrape import ClassDoc
import nimare.meta.cbma as nicoords
import nimare.meta.ibma as niimgs
import nimare.meta.kernel as nikern
import nimare.correct as crrct
import nimare

PARAM_OPTIONAL_REGEX = re.compile(r"(?:\:obj\:`)?(?P<type>.*?)`?(?:, optional|\(optional\))?$")

NIMARE_CORRECTORS = [
    "FDRCorrector",
    "FWECorrector",
]
NIMARE_COORDINATE_ALGORITHMS = [
    "MKDADensity",
    "KDA",
    "MKDAChi2",
    "ALE",
    "ALESubtraction",
    "SCALE",
]

NIMARE_IMAGE_ALGORITHMS = [
    "DerSimonianLaird",
    "Fishers",
    "Hedges",
    "PermutedOLS",
    "SampleSizeBasedLikelihood",
    "Stouffers",
    "VarianceBasedLikelihood",
    "WeightedLeastSquares",
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

config = {
    "VERSION": nimare.__version__,
    "CBMA": {},
    "IBMA": {},
    "CORRECTOR": {},
}


def _derive_type(type_name):
    if "or" in type_name:
        spl = type_name.split(' ')
        type_name, _ = spl[0], spl[1:]
    optional_type = PARAM_OPTIONAL_REGEX.match(type_name)
    if optional_type:
        return optional_type.group("type")
    return type_name


for algo in NIMARE_COORDINATE_ALGORITHMS:
    func = getattr(nicoords, algo)
    docs = ClassDoc(func)
    func_signature = inspect.signature(func)
    config["CBMA"][algo] = {
        "summary": ' '.join(docs._parsed_data["Summary"]),
        "parameters": {
            param.name: {
                "description": ' '.join(param.desc),
                "type": _derive_type(param.type) or None,
                "default": getattr(func_signature.parameters.get(param.name), "default", None),
            } for param in docs._parsed_data["Parameters"] if param.name not in BLACKLIST_PARAMS
        }
    }

    kern_func = getattr(nikern, DEFAULT_KERNELS[algo])
    kern_docs = ClassDoc(kern_func)
    kern_func_signature = inspect.signature(kern_func)
    config["CBMA"][algo]['parameters'].update(
        {
            "kernel__" + param.name: {
                "description": ' '.join(param.desc),
                "type": _derive_type(param.type),
                "default":  getattr(kern_func_signature.parameters.get(param.name), "default", None),
            } for param in kern_docs._parsed_data["Parameters"] if param.name not in BLACKLIST_PARAMS
        }
    )

for corrector in NIMARE_CORRECTORS:
    func = getattr(crrct, corrector)
    docs = ClassDoc(func)
    func_signature = inspect.signature(func)
    config["CORRECTOR"][corrector] = {
        "summary": ' '.join(docs._parsed_data["Summary"]),
        "parameters": {
            param.name: {
                "description": ' '.join(param.desc),
                "type": _derive_type(param.type) or None,
                "default": getattr(func_signature.parameters.get(param.name), "default", None),
            } for param in docs._parsed_data["Parameters"] if param.name not in BLACKLIST_PARAMS
        }
    }


for algo in NIMARE_IMAGE_ALGORITHMS:
    func = getattr(niimgs, algo)
    docs = ClassDoc(func)
    func_signature = inspect.signature(func)
    config["IBMA"][algo] = {
        "summary": ' '.join(docs._parsed_data["Summary"]),
        "parameters": {
            param.name: {
                "description": ' '.join(param.desc),
                "type": _derive_type(param.type) or None,
                "default": getattr(func_signature.parameters.get(param.name), "default", None),
            } for param in docs._parsed_data["Parameters"] if param.name not in BLACKLIST_PARAMS
        }
    }


# save config file
fname = Path(__file__).parent.parent / "src" / "assets" / "config" / "meta_analysis_params.json"

with open(fname, "w+") as c:
    json.dump(config, c, indent=4)

import inspect
import json
from pathlib import Path
import re


from numpydoc.docscrape import ClassDoc, FunctionDoc
import nimare.meta.cbma as nicoords
import nimare.meta.ibma as niimgs
import nimare.meta.kernel as nikern
import nimare.correct as crrct
import nimare

PARAM_OPTIONAL_REGEX = re.compile(
    r"(?:\:obj\:`)?(?P<type>\{.*\}|.*?)(?:`)?(?:(?:, optional|\(optional\))|(?:, default=(?P<default>.*)))?$"
)

NIMARE_CORRECTORS = [
    ("FDRCorrector", getattr(crrct, "FDRCorrector")),
    ("FWECorrector", getattr(crrct, "FWECorrector")),
]

NIMARE_COORDINATE_ALGORITHMS = inspect.getmembers(nicoords, inspect.isclass)

NIMARE_IMAGE_ALGORITHMS = [
    cls
    for cls in inspect.getmembers(niimgs, inspect.isclass)
    if cls[0]
    not in [
        "NiftiMasker",
        "MetaEstimator",
        "Memory",
        "Estimator",
        "IBMAEstimator",
        "Memory",
    ]
]


DEFAULT_KERNELS = {
    "MKDADensity": "MKDAKernel",
    "MKDAChi2": "MKDAKernel",
    "KDA": "KDAKernel",
    "ALE": "ALEKernel",
    "ALESubtraction": "ALEKernel",
    "SCALE": "ALEKernel",
}

BLACKLIST_ALGORITHMS = ["SCALE"]

BLACKLIST_PARAMS = [
    "n_cores",
    "memory_limit",
    "null_distributions_",
    "inputs_",
    "masker",
    "kernel_transformer",
    "memory",
    "memory_level",
    "result",
    "self",
]

config = {
    "VERSION": nimare.__version__,
    "CBMA": {},
    "IBMA": {},
    "CORRECTOR": {},
}


def _derive_type(type_name):
    if "or" in type_name:
        spl = type_name.split(" ")
        type_name, _ = spl[0], spl[1:]
    optional_type = PARAM_OPTIONAL_REGEX.match(type_name)
    if optional_type:
        return optional_type.group("type"), optional_type.group("default")
    return type_name, None


def _derive_default(class_signature, param):
    default = getattr(cls_signature.parameters.get(param.name), "default", None)
    if isinstance(default, tuple):
        default = default[0]

    if default is inspect._empty:
        default = None

    # try to parse default from docstring
    if default is None:
        dtype, default = _derive_type(param.type)
        if default is not None:
            if dtype == "int":
                default = int(default)
            elif dtype == "float":
                default = float(default)
            elif dtype == "bool":
                if default.lower() == "true":
                    default = True
                elif default.lower() == "false":
                    default = False
            elif dtype == "str":
                default = str(default)
            elif dtype == "list":
                default = list(default)
            elif dtype == "tuple":
                default = tuple(default)
            elif dtype == "dict":
                default = dict(default)
            elif dtype == "set":
                default = set(default)
            elif dtype == "NoneType":
                default = None
            else:
                raise ValueError(f"Unknown type: {dtype}")
    if isinstance(default, tuple):
        default = default[0]
    return default


def _is_pairwise_cbma(cls):
    return any(base.__name__ == "PairwiseCBMAEstimator" for base in inspect.getmro(cls))


def _check_fwe(cls):
    # Check if the method exists
    has_method = hasattr(cls, "correct_fwe_montecarlo")
    if has_method:
        # Get the method
        method = getattr(cls, "correct_fwe_montecarlo")

        # Get the source code of the method
        source_code = inspect.getsource(method)

        # Check if the source code contains 'NotImplementedError'
        fwe_enabled = "NotImplementedError" not in source_code
    else:
        fwe_enabled = False

    if fwe_enabled:
        # Get the signature of the method
        method_signature = inspect.signature(method)

        # get the function docstring
        mdocs = FunctionDoc(method)

        # Get the default parameters of the method
        method_default_parameters = (
            {
                param.name: {
                    "description": " ".join(param.desc),
                    "type": _derive_type(param.type)[0] or None,
                    "default": _derive_default(method_signature, param),
                }
                for param in mdocs._parsed_data["Parameters"]
                if param.name not in BLACKLIST_PARAMS
            },
        )

        if isinstance(method_default_parameters, tuple):
            method_default_parameters = method_default_parameters[0]

        return True, method_default_parameters
    else:
        return False, None


for algo, cls in NIMARE_COORDINATE_ALGORITHMS:
    if algo in BLACKLIST_ALGORITHMS:
        continue
    docs = ClassDoc(cls)
    cls_signature = inspect.signature(cls)

    summary = " ".join(docs._parsed_data["Summary"])
    if _is_pairwise_cbma(cls):
        summary = summary + " Uses Reference/Comparison Studyset."

    config["CBMA"][algo] = {
        "summary": summary,
        "parameters": {
            param.name: {
                "description": " ".join(param.desc),
                "type": _derive_type(param.type)[0] or None,
                "default": _derive_default(cls_signature, param),
            }
            for param in docs._parsed_data["Parameters"]
            if param.name not in BLACKLIST_PARAMS
        },
        "FWE_enabled": _check_fwe(cls)[0],
        "FWE_parameters": _check_fwe(cls)[1],
    }

    kern_cls = getattr(nikern, DEFAULT_KERNELS[algo])
    kern_docs = ClassDoc(kern_cls)
    kern_cls_signature = inspect.signature(kern_cls)
    config["CBMA"][algo]["parameters"].update(
        {
            "kernel__"
            + param.name: {
                "description": " ".join(param.desc),
                "type": _derive_type(param.type)[0],
                "default": _derive_default(kern_cls_signature, param),
            }
            for param in kern_docs._parsed_data["Parameters"]
            if param.name not in BLACKLIST_PARAMS
        }
    )

for corrector, cls in NIMARE_CORRECTORS:
    docs = ClassDoc(cls)
    cls_signature = inspect.signature(cls)
    config["CORRECTOR"][corrector] = {
        "summary": " ".join(docs._parsed_data["Summary"]),
        "parameters": {
            param.name: {
                "description": " ".join(param.desc),
                "type": _derive_type(param.type)[0] or None,
                "default": _derive_default(cls_signature, param),
            }
            for param in docs._parsed_data["Parameters"]
            if param.name not in BLACKLIST_PARAMS
        },
    }


for algo, cls in NIMARE_IMAGE_ALGORITHMS:
    if algo in BLACKLIST_ALGORITHMS:
        continue
    docs = ClassDoc(cls)
    cls_signature = inspect.signature(cls)
    config["IBMA"][algo] = {
        "summary": " ".join(docs._parsed_data["Summary"]),
        "parameters": {
            param.name: {
                "description": " ".join(param.desc),
                "type": _derive_type(param.type)[0] or None,
                "default": _derive_default(cls_signature, param),
            }
            for param in docs._parsed_data["Parameters"]
            if param.name not in BLACKLIST_PARAMS
        },
        "FWE_enabled": _check_fwe(cls)[0],
        "FWE_parameters": _check_fwe(cls)[1],
    }

# SET MANUAL DEFAULTS (Hacks!)
# for some reason treating this as a set causes errors :(
config["CORRECTOR"]["FWECorrector"]["parameters"]["method"]["type"] = "str"
# since we don't have sample size, setting another reasonable default
config["CBMA"]["ALE"]["parameters"]["kernel__fwhm"]["default"] = 8
config["CBMA"]["ALESubtraction"]["parameters"]["kernel__fwhm"]["default"] = 8

# save config file(s)
output_paths = [
    Path(__file__).parent.parent
    / "NiMARE"
    / "src"
    / "assets"
    / "config"
    / "meta_analysis_params.json",
    Path(__file__).parent.parent
    / "src"
    / "assets"
    / "config"
    / "meta_analysis_params.json",
]

for fname in output_paths:
    fname.parent.mkdir(parents=True, exist_ok=True)
    with open(fname, "w+") as c:
        json.dump(config, c, indent=4)

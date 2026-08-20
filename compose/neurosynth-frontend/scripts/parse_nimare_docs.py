"""Generate the algorithm metadata the frontend uses to build its forms.

By default this rewrites only the IBMA section of the config, leaving the
CBMA and CORRECTOR sections byte-identical. That keeps the CBMA defaults
users already depend on frozen while the IBMA side catches up: the committed
config was generated from a much older NiMARE, so a full regeneration would
churn every CBMA entry at once. Pass ``--sections all`` to regenerate
everything deliberately.

Requires the pinned NiMARE plus numpydoc::

    pip install -r scripts/requirements.txt
    python scripts/parse_nimare_docs.py
"""

import argparse
import inspect
import json
from pathlib import Path
import re
import sys


from numpydoc.docscrape import ClassDoc, FunctionDoc
import nimare.meta.cbma as nicoords
import nimare.meta.ibma as niimgs
import nimare.meta.kernel as nikern
import nimare.correct as crrct
import nimare

from nimare.meta.ibma import IBMAEstimator

PARAM_OPTIONAL_REGEX = re.compile(
    r"(?:\:obj\:`)?(?P<type>\{.*\}|.*?)(?:`)?(?:(?:, optional|\(optional\))|(?:, default=(?P<default>.*)))?$"
)

NIMARE_CORRECTORS = [
    ("FDRCorrector", getattr(crrct, "FDRCorrector")),
    ("FWECorrector", getattr(crrct, "FWECorrector")),
]

NIMARE_COORDINATE_ALGORITHMS = inspect.getmembers(nicoords, inspect.isclass)


def _concrete_estimators(module, base_cls):
    """Return the concrete estimator classes exported by a NiMARE module.

    Selecting by base class rather than excluding known non-estimators means
    imports that happen to live in the module namespace (``Counter``,
    ``NiftiMasker``, ``DEFAULT_FLOAT_DTYPE``, ...) can never leak into the
    config as if they were algorithms.
    """
    return sorted(
        (name, cls)
        for name, cls in inspect.getmembers(module, inspect.isclass)
        if base_cls in inspect.getmro(cls)
        and cls is not base_cls
        and cls.__module__.startswith("nimare")
        and not getattr(cls, "__abstractmethods__", None)
    )


NIMARE_IMAGE_ALGORITHMS = _concrete_estimators(niimgs, IBMAEstimator)


DEFAULT_KERNELS = {
    "MKDADensity": "MKDAKernel",
    "MKDAChi2": "MKDAKernel",
    "KDA": "KDAKernel",
    "ALE": "ALEKernel",
    "ALESubtraction": "ALEKernel",
    "SCALE": "ALEKernel",
}

# SCALE needs a study-specific null that the frontend cannot supply.
# BalancedALESubtraction is new in NiMARE 0.20.0; exposing it would add a CBMA
# algorithm, and this change is meant to be additive for IBMA only. Drop it
# from this list (and give it a DEFAULT_KERNELS entry) to surface it later.
BLACKLIST_ALGORITHMS = ["SCALE", "BalancedALESubtraction"]

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

# NiMARE's ``groupby`` accepts None, a metadata field name, an array of labels,
# or False. A JSON config and a form built from it can express at most the
# first two, and False -- treating every image from a study as independent --
# inflates significance whenever that is untrue. Leaving it out means every
# meta-analysis gets NiMARE's default, which groups by study_id. The escape
# hatch for the rest is the specification's "**kwargs" entry.
BLACKLIST_IBMA_PARAMS = ["groupby"]

config = {
    "VERSION": nimare.__version__,
    "CBMA": {},
    "IBMA": {},
    "CORRECTOR": {},
}


def _normalize_choices(type_name):
    """Rewrite a numpydoc choice set so the frontend can parse it.

    The frontend turns a ``{...}`` type into a select by swapping the braces
    for brackets and calling ``JSON.parse``, which rejects single quotes. NumPy
    docstrings are written with single quotes, so ``{'ml', 'reml'}`` reached the
    form as a parse error and the select rendered empty. The entries that do
    work in the committed config are already double-quoted; match them.
    """
    if not (type_name.startswith("{") and type_name.endswith("}")):
        return type_name
    if '"' in type_name:
        return type_name
    return type_name.replace("'", '"')


def _derive_type(type_name):
    if "or" in type_name:
        spl = type_name.split(" ")
        type_name, _ = spl[0], spl[1:]
    optional_type = PARAM_OPTIONAL_REGEX.match(type_name)
    if optional_type:
        return (
            _normalize_choices(optional_type.group("type")),
            optional_type.group("default"),
        )
    return _normalize_choices(type_name), None


def _derive_default(class_signature, param):
    # NOTE: this used to read the module-global `cls_signature` instead of its
    # own argument. Every caller assigned that global immediately beforehand,
    # so the output was the same, but it made the function impossible to reuse.
    default = getattr(class_signature.parameters.get(param.name), "default", None)
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


def _inherited_default(cls, param_name):
    """Find a documented parameter's default on a base class ``__init__``.

    Estimators like ``WeightedLeastSquares`` accept ``weight_scheme`` and
    ``rho`` through ``**kwargs`` and let ``_PyMARERegressionEstimator`` apply
    them, so ``inspect.signature()`` on the subclass cannot see them even
    though its docstring documents them. Without this the config would claim
    those parameters default to None, and the frontend would post None back to
    an estimator that expects a weight scheme.
    """
    for base in inspect.getmro(cls)[1:]:
        init = base.__dict__.get("__init__")
        if init is None:
            continue
        parameter = inspect.signature(init).parameters.get(param_name)
        if parameter is not None and parameter.default is not inspect._empty:
            return parameter.default
    return None


def _ibma_default(cls, class_signature, param):
    """The default for a documented IBMA parameter, own signature first."""
    default = _derive_default(class_signature, param)
    if default is None:
        default = _inherited_default(cls, param.name)
    return default


def _is_pairwise_cbma(cls):
    return any(base.__name__ == "PairwiseCBMAEstimator" for base in inspect.getmro(cls))


def _is_multigroup(cls):
    """Whether the estimator compares two groups of studies.

    Checked by base class so the frontend can stop hardcoding a list of
    algorithm names to decide when to ask for a reference studyset.
    """
    return any(
        base.__name__ in ("PairwiseCBMAEstimator", "PairwiseIBMAEstimator")
        for base in inspect.getmro(cls)
    )


def _requirements(cls):
    """Describe the data an estimator needs, from its ``_required_inputs``.

    ``_required_inputs`` maps an input name onto ``(kind, detail)``, where kind
    is one of "image", "metadata" or "coordinates". Surfacing this lets the
    frontend tell the user up front which studies lack the maps an estimator
    needs, instead of failing at run time.
    """
    required = getattr(cls, "_required_inputs", {}) or {}
    images, metadata, coordinates = set(), set(), False

    for input_name, spec in required.items():
        if isinstance(spec, (tuple, list)):
            kind = spec[0]
            detail = spec[1] if len(spec) > 1 else None
        else:
            kind, detail = spec, None

        if kind == "coordinates":
            coordinates = True
        elif kind == "image":
            images.add(detail or input_name)
        elif kind == "metadata":
            metadata.add(detail or input_name)

    return {
        "coordinates": coordinates,
        "images": sorted(images),
        "metadata": sorted(metadata),
    }


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

    if algo not in DEFAULT_KERNELS:
        raise KeyError(
            f"No default kernel is registered for the CBMA algorithm '{algo}'. "
            "NiMARE has probably added it since this script last ran: give it an "
            "entry in DEFAULT_KERNELS to expose it, or add it to "
            "BLACKLIST_ALGORITHMS to keep it out of the frontend."
        )

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
    fwe_enabled, fwe_parameters = _check_fwe(cls)
    config["IBMA"][algo] = {
        "summary": " ".join(docs._parsed_data["Summary"]),
        "parameters": {
            param.name: {
                "description": " ".join(param.desc),
                "type": _derive_type(param.type)[0] or None,
                "default": _ibma_default(cls, cls_signature, param),
            }
            for param in docs._parsed_data["Parameters"]
            if param.name not in BLACKLIST_PARAMS
            and param.name not in BLACKLIST_IBMA_PARAMS
        },
        "FWE_enabled": fwe_enabled,
        "FWE_parameters": fwe_parameters,
        "multigroup": _is_multigroup(cls),
        "requirements": _requirements(cls),
    }

# SET MANUAL DEFAULTS (Hacks!)
# for some reason treating this as a set causes errors :(
config["CORRECTOR"]["FWECorrector"]["parameters"]["method"]["type"] = "str"
# since we don't have sample size, setting another reasonable default
config["CBMA"]["ALE"]["parameters"]["kernel__fwhm"]["default"] = 8
config["CBMA"]["ALESubtraction"]["parameters"]["kernel__fwhm"]["default"] = 8

# Use the liberal mask by default for every IBMA estimator. The aggressive mask
# drops any voxel that is zero or NaN in *any* input map, which across
# heterogeneous studysets can discard most of the brain; the liberal path
# instead analyses bags of voxels that share a validity pattern. It is slower,
# but losing coverage silently is worse. NiMARE agreed and flipped its own
# default to False in 0.21.0, so this is now belt-and-braces -- keep it, so
# compose does not follow if upstream ever flips back.
for algo in config["IBMA"]:
    if "aggressive_mask" in config["IBMA"][algo]["parameters"]:
        config["IBMA"][algo]["parameters"]["aggressive_mask"]["default"] = False

# Every exposed IBMA parameter has to be a real keyword the estimator accepts,
# because the executor passes the stored arguments straight to its constructor.
# An earlier version of this config carried a "dependence" parameter that
# NiMARE never had; it reached the estimator as an unused kwarg and silently
# did nothing. Fail loudly here instead.
for algo, cls in NIMARE_IMAGE_ALGORITHMS:
    if algo in BLACKLIST_ALGORITHMS:
        continue
    accepted = set()
    for base in inspect.getmro(cls):
        init = base.__dict__.get("__init__")
        if init is not None:
            accepted.update(inspect.signature(init).parameters)
    unknown = sorted(set(config["IBMA"][algo]["parameters"]) - accepted)
    if unknown:
        raise ValueError(
            f"{algo} would expose parameters NiMARE does not accept: {unknown}. "
            "The docstring and the signature have drifted apart, or a parameter "
            "was removed upstream."
        )

# A parameter inherited through **kwargs is invisible to inspect.signature() on
# the subclass, so its default silently came out as None. None is not a valid
# weight_scheme or rho, and the frontend seeds the form from these values.
for algo, spec in config["IBMA"].items():
    missing = sorted(
        name for name, param in spec["parameters"].items() if param["default"] is None
    )
    if missing:
        raise ValueError(
            f"{algo} has IBMA parameters with no derivable default: {missing}. "
            "Check whether NiMARE moved them onto a base class."
        )

# save config file
output_paths = [
    Path(__file__).parent.parent
    / "src"
    / "assets"
    / "config"
    / "meta_analysis_params.json",
]

def _parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--sections",
        default="ibma",
        choices=["ibma", "all"],
        help=(
            "Which parts of the config to rewrite. 'ibma' (the default) leaves "
            "VERSION, CBMA and CORRECTOR exactly as they are on disk. 'all' "
            "regenerates the whole file, which will churn the CBMA defaults."
        ),
    )
    parser.add_argument(
        "--allow-version-mismatch",
        action="store_true",
        help="Proceed even if the installed NiMARE differs from the backend's pin.",
    )
    return parser.parse_args(argv)


def _pinned_nimare_version():
    """Read the NiMARE version the compose backend pins, if we can find it."""
    pyproject = Path(__file__).resolve().parents[2] / "backend" / "pyproject.toml"
    if not pyproject.is_file():
        return None
    match = re.search(r"NiMARE\s*==\s*(?P<version>[\w.]+)", pyproject.read_text())
    return match.group("version") if match else None


def main(argv=None):
    args = _parse_args(argv)

    pinned = _pinned_nimare_version()
    # Ignore local-build suffixes like "0.20.0+4.g87ebdaa.dirty" so that
    # generating from a source checkout of the pinned release still works.
    installed = nimare.__version__.split("+")[0]
    if pinned and pinned != installed and not args.allow_version_mismatch:
        sys.exit(
            f"Installed NiMARE is {nimare.__version__} but the backend pins {pinned}. "
            "Generating from a different version would put defaults in the config that "
            "the backend will not honour. Install the pinned version, or pass "
            "--allow-version-mismatch if you know what you are doing."
        )

    for fname in output_paths:
        fname.parent.mkdir(parents=True, exist_ok=True)

        if args.sections == "ibma" and fname.is_file():
            # Merge into the existing file so only IBMA moves. The committed
            # config predates the current NiMARE, so VERSION deliberately keeps
            # describing the CBMA/CORRECTOR sections until those are
            # regenerated too (--sections all).
            with open(fname) as c:
                merged = json.load(c)
            merged["IBMA"] = config["IBMA"]
        else:
            merged = config

        with open(fname, "w+") as c:
            json.dump(merged, c, indent=4)


if __name__ == "__main__":
    main()

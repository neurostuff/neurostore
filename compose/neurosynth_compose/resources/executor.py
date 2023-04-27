from importlib import import_module

from nimare.nimads import Studyset, Annotation


def load_specification(spec):
    """Returns function to run analysis on dataset."""
    est_mod = import_module(".".join(["nimare", "meta", "cbma"]))
    estimator = getattr(est_mod, spec["estimator"]["type"])
    if spec["estimator"].get("args"):
        if "kernel_transformer" in spec["estimator"].get("args"):
            kernel_mod = import_module(".".join(["nimare", "meta", "kernel"]))
            spec["estimator"]["args"]["kernel_transformer"] = getattr(
                kernel_mod, spec["estimator"]["args"]["kernel_transformer"]
            )
        est_args = {**spec["estimator"]["args"]}

        if est_args.get("**kwargs") is not None:
            for k, v in est_args["**kwargs"].items():
                est_args[k] = v
            del est_args["**kwargs"]
        estimator_init = estimator(**est_args)
    else:
        estimator_init = estimator()

    if spec.get("corrector"):
        cor_mod = import_module(".".join(["nimare", "correct"]))
        corrector = getattr(cor_mod, spec["corrector"]["type"] + "Corrector")
        if spec["corrector"].get("args"):
            cor_args = {**spec["corrector"]["args"]}
            if cor_args.get("**kwargs") is not None:
                for k, v in cor_args["**kwargs"].items():
                    cor_args[k] = v
                del cor_args["**kwargs"]
            corrector_init = corrector(**cor_args)
        else:
            corrector_init = corrector()
    else:
        corrector_init = None

    return estimator_init, corrector_init


def process_bundle(studyset_dict, annotation_dict, specification_dict):
    studyset = Studyset(studyset_dict)
    annotation = Annotation(annotation_dict, studyset)
    include = specification_dict["filter"]
    analysis_ids = [n.analysis.id for n in annotation.notes if n.note[f"{include}"]]
    filtered_studyset = studyset.slice(analyses=analysis_ids)
    dataset = filtered_studyset.to_dataset()
    estimator, corrector = load_specification(specification_dict)
    return dataset, estimator, corrector

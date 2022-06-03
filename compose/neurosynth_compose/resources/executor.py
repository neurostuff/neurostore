from importlib import import_module

from nimare.dataset import Dataset


def _analysis_to_dict(ns_study, ns_analysis):
    return {
        'metadata': {
                  'authors': ns_study['authors'],
                  'journal': ns_study['publication'],
                  'title': ns_study['name'],
        },
        'coords': {
            'space': ns_analysis['points'][0]['space'],
            'x': [p['coordinates'][0] for p in ns_analysis['points']],
            'y': [p['coordinates'][1] for p in ns_analysis['points']],
            'z': [p['coordinates'][2] for p in ns_analysis['points']],
        }
    }


def _study_to_dict(ns_study):
    return {
              'metadata': {
                  'authors': ns_study['authors'],
                  'journal': ns_study['publication'],
                  'title': ns_study['name'],
              },
              'contrasts': {a['id']: _analysis_to_dict(ns_study, a) for a in ns_study['analyses']}
    }


def convert_neurostore_to_dict(studyset_neurostore):
    return {s['id']: _study_to_dict(s) for s in studyset_neurostore['studies']}


def create_workflow(spec):
    """returns function to run analysis on dataset"""
    est_mod = import_module('.'.join(['nimare', 'meta', spec['type']]))
    estimator = getattr(est_mod, spec['estimator']['algorithm'])
    if spec['estimator'].get('kernel_transformer'):
        kern_mod = import_module('.'.join(['nimare', 'meta', 'kernel']))
        kern = getattr(kern_mod, spec['estimator']['kernel_transformer'])
        kern_args = spec['estimator'].copy()
        del kern_args['algorithm']
        del kern_args['kernel_transformer']
        estimator_init = estimator(kern(**kern_args))
    else:
        estimator_init = estimator()

    if spec.get('corrector'):
        cor_mod = import_module('.'.join(['nimare', 'correct']))
        corrector = getattr(cor_mod, spec['corrector']['type'] + 'Corrector')
        corrector_args = spec['corrector'].copy()
        del corrector_args['type']
        corrector_init = corrector(**corrector_args)
    else:
        corrector_init = None

    if corrector_init:
        return lambda dset: corrector_init.transform(estimator_init.fit(dset))
    else:
        return lambda dset: estimator_init.fit(dset)


def filter_analyses(specification, annotation):
    column = specification['filter']
    keep_ids = []
    for annot in annotation['notes']:
        if annot['note'].get(column):
            keep_ids.append(f"{annot['study']}-{annot['analysis']}")
    return keep_ids


def run_nimare(meta_analysis):
    sset = Dataset(convert_neurostore_to_dict(meta_analysis['studyset']['snapshot']))
    wf = create_workflow(meta_analysis['specification'])
    selected_analyses = filter_analyses(
        meta_analysis['specification'],
        meta_analysis['annotation']['snapshot']
    )
    filtered_sset = sset.slice(selected_analyses)
    return wf(filtered_sset)

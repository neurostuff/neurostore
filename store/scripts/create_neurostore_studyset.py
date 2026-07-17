"""DEPRECATED legacy NeuroStore-wide studyset helper.

Do not use this script for new NeuroStore-wide studyset generation. The
maintained implementation is:

    store/backend/neurostore/services/neurostore_studyset_releases.py

Use the ``build_neurostore_studyset_release`` service or the
``neurostore build-neurostore-studyset-release`` CLI instead. That path creates the
canonical ``neurostore-studyset`` / ``neurostore-annotation`` records, applies
the current study selection rules, writes release manifests, and builds the
downloadable release artifact.

This file is kept only as a historical reference while downstream callers are
migrated. It should be removed once no jobs or notebooks import it.
"""

import sys
import warnings

from sqlalchemy.orm import joinedload

from neurostore.models import BaseStudy, Studyset


DEPRECATION_MESSAGE = (
    "DEPRECATED: store/scripts/create_neurostore_studyset.py is legacy. "
    "Use neurostore.services.neurostore_studyset_releases."
    "build_neurostore_studyset_release or the "
    "`neurostore build-neurostore-studyset-release` CLI instead."
)

print(DEPRECATION_MESSAGE, file=sys.stderr)
warnings.warn(DEPRECATION_MESSAGE, FutureWarning, stacklevel=2)


base_studies = (
    BaseStudy.query.options(joinedload("versions"))
    .filter_by(has_coordinates=True)
    .all()
)

neurostore_studyset = []
for bs in base_studies:
    if not bs.versions or not bs.has_coordinates:
        continue
    selected_study = bs.versions[0]

    for v in bs.versions[1:]:
        if not v.has_coordinates:
            continue

        if v.user is not None:
            if selected_study.user is None:
                selected_study = v
            else:
                if (selected_study.updated_at or selected_study.created_at) <= (
                    v.updated_at or v.created_at
                ):
                    selected_study = v
    neurostore_studyset.append(selected_study)

ss = Studyset(
    name="Neurostore Studyset",
    description=(
        "aggregation of studies on the neurostore database. Ran periodically, "
        "may not represent the latest state of the database."
    ),
    studies=neurostore_studyset,
)

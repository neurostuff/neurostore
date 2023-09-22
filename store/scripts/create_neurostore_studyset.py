from neurostore.models import BaseStudy, Studyset
from sqlalchemy.orm import joinedload


base_studies = BaseStudy.query.options(
    joinedload("versions")
).filter_by(has_coordinates=True).all()

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
                if (
                    selected_study.updated_at or selected_study.created_at
                ) <= (v.updated_at or v.created_at):
                    selected_study = v
    neurostore_studyset.append(selected_study)

ss = Studyset(name="Neurostore Studyset", description="aggregation of studies on the neurostore database. Ran periodically, may not represent the latest state of the database.", studies=neurostore_studyset)



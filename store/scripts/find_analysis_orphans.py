from sqlalchemy import exists, or_
from neurostore.models.data import Study, Analysis, Point, Image
from neurostore.database import db

# Get studies without base_study_id that have analyses with points or images
orphans_with_analyses = Study.query.filter(
    Study.base_study_id == None,  # Studies without base_study_id
    or_(
        # Has analysis with points
        exists().where(
            Analysis.study_id == Study.id,
            exists().where(Point.analysis_id == Analysis.id)
        ),
        # Has analysis with images
        exists().where(
            Analysis.study_id == Study.id,
            exists().where(Image.analysis_id == Analysis.id)
        )
    )
).all()

print(f"Found {len(orphans_with_analyses)} orphan studies with analyses containing points or images:")
for study in orphans_with_analyses:
    print(f"\nStudy ID: {study.id}")
    print(f"Name: {study.name}")
    
    # Count points and images for this study
    point_count = db.session.query(Point)\
        .join(Analysis)\
        .filter(Analysis.study_id == study.id)\
        .count()
        
    image_count = db.session.query(Image)\
        .join(Analysis)\
        .filter(Analysis.study_id == study.id)\
        .count()
        
    print(f"Points: {point_count}")
    print(f"Images: {image_count}")
    
    # Print identifiers if available
    if study.pmid:
        print(f"PMID: {study.pmid}")
    if study.doi:
        print(f"DOI: {study.doi}")
    if study.pmcid:
        print(f"PMCID: {study.pmcid}")

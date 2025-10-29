from Bio import Entrez
from sqlalchemy import and_, or_
from neurostore.models.data import BaseStudy, Study
from neurostore.database import db
from find_missing_identifiers import (
    get_article_details, 
    find_existing_study,
    merge_base_studies,
    titles_match
)

# Configure Entrez email (required for NCBI API access)
Entrez.email = "jamesdkent21@gmail.com"

def create_base_study(study, article_details=None):
    """Create a new base study from a study and optional PubMed details"""
    base_study = BaseStudy()
    
    # Copy basic info from study
    base_study.name = study.name
    base_study.description = study.description
    base_study.pmid = study.pmid
    base_study.doi = study.doi
    base_study.pmcid = study.pmcid
    
    # Update with PubMed details if available
    if article_details:
        if 'doi' in article_details:
            base_study.doi = article_details['doi']
        if 'pmcid' in article_details:
            base_study.pmcid = article_details['pmcid']
            
    return base_study

def update_orphan_studies():
    """Find orphan studies and either link to existing base studies or create new ones"""
    print("Starting orphan study update...")
    
    # Get orphan studies with some form of identifier
    orphan_studies = Study.query.filter(Study.base_study_id == None)\
        .filter(or_(
            Study.pmid != None,
            Study.doi != None,
            Study.pmcid != None
        )).all()
    
    print(f"Found {len(orphan_studies)} orphan studies with identifiers")
    
    updated = 0
    created = 0
    skipped = 0
    to_commit = []
    
    for study in orphan_studies:
        print(f"\nProcessing study: {study.name}")
        
        # Try to find existing base study by identifiers
        identifiers = {
            'pmid': study.pmid,
            'doi': study.doi,
            'pmcid': study.pmcid
        }
        existing = find_existing_study(identifiers)
        
        if existing:
            print(f"Found matching base study (ID: {existing.id})")
            study.base_study_id = existing.id
            to_commit.append(study)
            updated += 1
            continue
            
        # If study has PMID, get additional metadata from PubMed
        article_details = None
        if study.pmid:
            print(f"Fetching PubMed details for PMID: {study.pmid}")
            article_details = get_article_details(study.pmid)
            
            if article_details and study.name:
                # Verify title match
                if not titles_match(study.name, article_details['title']):
                    print("Warning: PubMed title doesn't match study title")
                    article_details = None
        
        # Create new base study
        base_study = create_base_study(study, article_details)
        db.session.add(base_study)
        db.session.flush()  # Get ID for the new base study
        
        # Link study to new base study
        study.base_study_id = base_study.id
        to_commit.extend([base_study, study])
        created += 1
        
        print(f"Created new base study (ID: {base_study.id})")
    
    print(f"\nStudies processed:")
    print(f"- Updated {updated} studies with existing base studies")
    print(f"- Created {created} new base studies")
    print(f"- Skipped {skipped} studies")
    
    return to_commit

if __name__ == "__main__":
    try:
        # Start transaction
        db.session.begin()
        
        # Process orphan studies
        to_commit = update_orphan_studies()
        
        # Commit changes
        if to_commit:
            db.session.add_all(to_commit)
            db.session.commit()
            print(f"\nSuccessfully processed {len(to_commit)} studies")
        else:
            print("\nNo studies were updated")
            
    except Exception as e:
        print(f"\nError occurred: {str(e)}")
        db.session.rollback()
        raise
    finally:
        print("Orphan study update complete!")

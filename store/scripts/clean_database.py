from Bio import Entrez
from Bio.Entrez.Parser import ValidationError
from sqlalchemy import and_, or_, func
from neurostore.models.data import BaseStudy, Study
from neurostore.database import db
from sqlalchemy.orm import joinedload
import re
import time
import requests
from urllib.parse import quote
from typing import Dict, List, Any

# Configure Entrez email (required for NCBI API access)
Entrez.email = "jamesdkent21@gmail.com"

# Utility functions
def exponential_backoff_request(url, max_retries=6, initial_delay=1):
    """Make a request with exponential backoff for rate limiting"""
    delay = initial_delay
    for attempt in range(max_retries):
        try:
            response = requests.get(url)
            if response.status_code == 429:  # Too Many Requests
                if attempt == max_retries - 1:
                    print(f"Rate limit exceeded after {max_retries} retries")
                    return None
                    
                wait_time = delay * (2 ** attempt)  # Exponential backoff
                print(f"Rate limit hit, waiting {wait_time} seconds...")
                time.sleep(wait_time)
                continue
                
            response.raise_for_status()
            return response
            
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                print(f"Request failed after {max_retries} retries: {str(e)}")
                return None
            time.sleep(delay * (2 ** attempt))
            
    return None

def titles_match(title1, title2, threshold=0.9):
    """Compare two titles after cleaning and return True if they are similar enough"""
    if not title1 or not title2:
        return False
        
    clean1 = clean_string(title1)
    clean2 = clean_string(title2)
    
    if not clean1 or not clean2:
        return False
        
    # Convert to sets of words for comparison
    words1 = set(clean1.split())
    words2 = set(clean2.split())
    
    # Calculate word overlap ratio
    overlap = len(words1.intersection(words2))
    total = max(len(words1), len(words2))
    
    return (overlap / total) >= threshold

def clean_string(s):
    """Remove punctuation and convert to lowercase for matching"""
    if not s:
        return ""
    return re.sub(r'[^\w\s]', '', s).lower().strip()

def find_study(pmid=None, doi=None, query=None):
    """
    Search for a study using available identifiers or query string.
    Returns standardized metadata dict with found information.
    """
    result = {}
    
    # Try PubMed first if PMID available or query provided
    if pmid or query:
        try:
            if pmid:
                # Check for corrections first
                handle = Entrez.elink(dbfrom="pubmed", db="pubmed", id=pmid, cmd="neighbor_history")
                record = Entrez.read(handle)
                handle.close()
                
                # Look for PubMed corrections
                if record[0].get('LinkSetDb'):
                    for linkset in record[0]['LinkSetDb']:
                        if linkset.get('LinkName') == 'pubmed_pubmed_cites':
                            # Found a correction, use the new PMID
                            pmid = linkset['Link'][0]['Id']
                            print(f"Found correction, using PMID: {pmid}")
                
                # Fetch article details
                handle = Entrez.efetch(db="pubmed", id=pmid, rettype="medline", retmode="xml")
                articles = Entrez.read(handle)['PubmedArticle']
                handle.close()
                
                if articles:
                    article = articles[0]
                    article_data = article['MedlineCitation']['Article']
                    
                    # Extract basic metadata
                    result['title'] = article_data.get('ArticleTitle', '')
                    result['journal'] = article_data.get('Journal', {}).get('Title', '')
                    result['year'] = int(article_data.get('Journal', {}).get('JournalIssue', {}).get('PubDate', {}).get('Year', 0))
                    
                    # Get abstract
                    if 'Abstract' in article_data:
                        result['description'] = article_data['Abstract'].get('AbstractText', [''])[0]
                    
                    # Get authors
                    if 'AuthorList' in article_data:
                        authors = []
                        for author in article_data['AuthorList']:
                            if 'LastName' in author and 'ForeName' in author:
                                authors.append(f"{author['LastName']}, {author['ForeName']}")
                        result['authors'] = ';'.join(authors)
                    
                    # Get identifiers
                    result['pmid'] = pmid
                    for id_obj in article['PubmedData'].get('ArticleIdList', []):
                        if id_obj.attributes.get('IdType') == 'doi':
                            result['doi'] = str(id_obj)
                        elif id_obj.attributes.get('IdType') == 'pmc':
                            result['pmcid'] = str(id_obj)
                            
            elif query:
                # Search PubMed by query
                handle = Entrez.esearch(db="pubmed", term=f"{query}[Title]", retmax=5)
                record = Entrez.read(handle)
                handle.close()
                
                if record['IdList']:
                    # Recursively call with found PMID
                    return find_study(pmid=record['IdList'][0])
                    
        except Exception as e:
            print(f"Error searching PubMed: {str(e)}")
    
    # Try Semantic Scholar if no result yet or if DOI provided
    if not result and (doi or query):
        try:
            if doi:
                url = f"https://api.semanticscholar.org/graph/v1/paper/{doi}?fields=title,abstract,venue,year,authors,externalIds"
            else:
                url = f"https://api.semanticscholar.org/graph/v1/paper/search?query={quote(query)}&fields=title,abstract,venue,year,authors,externalIds"
                
            response = exponential_backoff_request(url)
            if not response:
                return None
                
            data = response.json()
            
            # Handle search vs direct lookup
            papers = [data] if doi else data.get('data', [])
            
            for paper in papers:
                # For searches, verify title match
                if query and not titles_match(query, paper.get('title', '')):
                    continue
                    
                if 'title' in paper:
                    result['title'] = paper['title']
                if 'abstract' in paper:
                    result['description'] = paper['abstract']
                if 'venue' in paper:
                    result['journal'] = paper['venue']
                if 'year' in paper:
                    result['year'] = paper['year']
                    
                # Get authors
                if 'authors' in paper:
                    result['authors'] = ';'.join(author['name'] for author in paper['authors'])
                    
                # Get identifiers
                if 'externalIds' in paper:
                    ids = paper['externalIds']
                    if 'DOI' in ids:
                        result['doi'] = ids['DOI']
                    if 'PubMed' in ids:
                        result['pmid'] = ids['PubMed']
                    if 'PubMedCentral' in ids:
                        result['pmcid'] = ids['PubMedCentral']
                        
                break  # Take first matching result
                
        except Exception as e:
            print(f"Error searching Semantic Scholar: {str(e)}")
            
    return result if result else None

def merge_studies(target_bs, studies_to_merge, study_metadata, dry_run=True):
    """
    Merge studies into target base study, supplementing missing metadata
    
    Args:
        target_bs: Best BaseStudy object identified as merge target
        studies_to_merge: List of BaseStudy objects to merge into target
        study_metadata: Dict of metadata from find_study() to use
        dry_run: If True, don't commit changes, just return what would change
        
    Returns:
        If dry_run=True: Dict with lists of objects to delete/commit
        If dry_run=False: Updated BaseStudy object or None on failure
    """
    changes = {
        'to_delete': [],
        'to_commit': []
    }
    
    try:
        # Start with a clean session to avoid state issues
        if not dry_run:
            db.session.rollback()
            db.session.begin()
            
        # Collect all available metadata (target, other studies, and API data)
        merged_metadata = {
            'name': target_bs.name,
            'description': target_bs.description,
            'publication': target_bs.publication,
            'year': target_bs.year if target_bs.year and target_bs.year > 1900 else None,
            'authors': target_bs.authors,
            'pmid': target_bs.pmid,
            'doi': target_bs.doi,
            'pmcid': target_bs.pmcid
        }
        
        # Update from study metadata (API data)
        if study_metadata:
            for key in merged_metadata:
                if not merged_metadata[key] and study_metadata.get(key):
                    merged_metadata[key] = study_metadata[key]
                    
        # Update from other studies
        for study in studies_to_merge:
            for key in ['name', 'description', 'publication', 'authors']:
                if not merged_metadata[key] and getattr(study, key):
                    merged_metadata[key] = getattr(study, key)
                    
            if not merged_metadata['year'] and study.year and study.year > 1900:
                merged_metadata['year'] = study.year
                    
        # Update target study with merged metadata
        print(f"\nChecking if target study {target_bs.id} needs updates:")
        old_values = {
            'name': target_bs.name,
            'description': target_bs.description,
            'publication': target_bs.publication,
            'year': target_bs.year,
            'authors': target_bs.authors,
            'pmid': target_bs.pmid,
            'doi': target_bs.doi,
            'pmcid': target_bs.pmcid
        }
        
        target_updated = False
        
        # Try to update each field
        if merged_metadata['name'] and not target_bs.name:
            print(f"Updating name from '{target_bs.name}' to '{merged_metadata['name']}'")
            target_bs.name = merged_metadata['name']
            target_updated = True
            
        if merged_metadata['description'] and not target_bs.description:
            print(f"Adding missing description")
            target_bs.description = merged_metadata['description']
            target_updated = True
            
        if merged_metadata['publication'] and not target_bs.publication:
            print(f"Adding publication: {merged_metadata['publication']}")
            target_bs.publication = merged_metadata['publication']
            target_updated = True
            
        if merged_metadata['year'] and (not target_bs.year or target_bs.year <= 1900):
            print(f"Updating year from {target_bs.year} to {merged_metadata['year']}")
            target_bs.year = merged_metadata['year']
            target_updated = True
            
        if merged_metadata['authors'] and not target_bs.authors:
            print("Adding missing authors")
            target_bs.authors = merged_metadata['authors']
            target_updated = True
            
        # Only update identifiers that are missing
        if merged_metadata['pmid'] and not target_bs.pmid:
            print(f"Adding PMID: {merged_metadata['pmid']}")
            target_bs.pmid = merged_metadata['pmid']
            target_updated = True
            
        if merged_metadata['doi'] and not target_bs.doi:
            print(f"Adding DOI: {merged_metadata['doi']}")
            target_bs.doi = merged_metadata['doi']
            target_updated = True
            
        if merged_metadata['pmcid'] and not target_bs.pmcid:
            print(f"Adding PMCID: {merged_metadata['pmcid']}")
            target_bs.pmcid = merged_metadata['pmcid']
            target_updated = True
            
        if target_updated:
            print(f"Target study {target_bs.id} had updates - adding to commit list")
            changes['to_commit'].append(target_bs)
        else:
            print(f"Target study {target_bs.id} needed no updates")
            
        # Collect all versions from all studies (including target if it's being merged)
        all_versions = []
        for study in studies_to_merge:
            all_versions.extend(study.versions)
        
        # If target study is in studies_to_merge, get its versions too
        if target_bs in studies_to_merge:
            print("Target study will be merged - collecting its versions first")
            all_versions.extend(target_bs.versions)
        
        print(f"Found {len(all_versions)} total versions to handle")
        
        # Move all versions to target
        for version in all_versions:
            print(f"Processing version {version.id}")
            updated = False
            
            # Use merged metadata to fill gaps in version
            if merged_metadata['name'] and not version.name:
                version.name = merged_metadata['name']
                updated = True
            if merged_metadata['description'] and not version.description:
                version.description = merged_metadata['description']
                updated = True
            if merged_metadata['publication'] and not version.publication:
                version.publication = merged_metadata['publication']
                updated = True
            if merged_metadata['year'] and (not version.year or version.year <= 1900):
                version.year = merged_metadata['year']
                updated = True
            if merged_metadata['authors'] and not version.authors:
                version.authors = merged_metadata['authors']
                updated = True
                
            # Use target study's identifiers
            if target_bs.pmid and not version.pmid:
                version.pmid = target_bs.pmid
                updated = True
            if target_bs.doi and not version.doi:
                version.doi = target_bs.doi
                updated = True
            if target_bs.pmcid and not version.pmcid:
                version.pmcid = target_bs.pmcid
                updated = True
                
            # Check if version needs to be moved
            needs_moving = version.base_study_id != target_bs.id
            if needs_moving:
                print(f"Moving version {version.id} from study {version.base_study_id} to {target_bs.id}")
                version.base_study_id = target_bs.id
                target_bs.versions.append(version)
                updated = True
                
            # Only add to commit list if actually changed
            if updated:
                print(f"Version {version.id} had updates - adding to commit list")
                changes['to_commit'].append(version)
            else:
                print(f"Version {version.id} needed no updates")
                
        # After processing all versions, check each study's versions before marking for deletion
        print("\nVerifying studies for deletion:")
        for study in studies_to_merge:
            if study.id == target_bs.id:
                print(f"Skipping target study {study.id}")
                continue
                
            study_versions = set(study.versions)
            committed_versions = {v for v in changes['to_commit'] if v in study_versions}
            unhandled_versions = study_versions - committed_versions
            
            if unhandled_versions:
                print(f"Study {study.id} has {len(unhandled_versions)} unhandled versions - cannot delete:")
                for v in unhandled_versions:
                    print(f"  Version {v.id} not marked as moved/updated")
            else:
                moved_versions = all(v.base_study_id == target_bs.id for v in study_versions)
                if moved_versions:
                    print(f"Study {study.id} verified - all {len(study_versions)} versions marked as moved")
                    changes['to_delete'].append(study)
                else:
                    print(f"Study {study.id} has versions not moved to target study - cannot delete")
            
        if dry_run:
            # Final verification in dry run mode
            for study in list(changes['to_delete']):
                study_versions = set(study.versions)
                committed_versions = {v for v in changes['to_commit'] if v in study_versions}
                if len(committed_versions) != len(study_versions):
                    print(f"Dry run check: Removing study {study.id} from deletion - versions mismatch")
                    changes['to_delete'].remove(study)
            return changes
            
        # Actually commit changes
        try:
            with db.session.no_autoflush:
                print("\nCommitting changes...")
                
                # First move and update versions
                version_updates = [obj for obj in changes['to_commit'] if isinstance(obj, Study)]
                print(f"Moving/updating {len(version_updates)} versions")
                for version in version_updates:
                    version.base_study_id = target_bs.id
                db.session.add_all(version_updates)
                
                # Flush to ensure version updates are registered
                print("Flushing version changes")
                db.session.flush()
                
                # Final verification before deleting studies
                print("\nVerifying studies before deletion:")
                for study in list(changes['to_delete']):
                    study_versions = set(study.versions)
                    if not study_versions:
                        print(f"Study {study.id} has no versions - safe to delete")
                        db.session.delete(study)
                        continue
                        
                    # Check all versions were updated and moved
                    updated_versions = {v for v in version_updates if v in study_versions}
                    if len(updated_versions) != len(study_versions):
                        print(f"Warning: Study {study.id} has versions not in update list - skipping deletion")
                        changes['to_delete'].remove(study)
                        continue
                        
                    # Verify all versions point to target study
                    if any(v.base_study_id != target_bs.id for v in study_versions):
                        print(f"Warning: Study {study.id} has versions not moved to target - skipping deletion")
                        changes['to_delete'].remove(study)
                        continue
                        
                    print(f"Study {study.id} verified - deleting")
                    db.session.delete(study)
                
                # Update target study last
                print("\nUpdating target study")
                if target_bs in changes['to_commit']:
                    db.session.add(target_bs)
                    
                print("\nCommitting transaction")
                db.session.commit()
                
            return target_bs
            
        except Exception as e:
            print(f"Error during commit: {str(e)}")
            db.session.rollback()
            return None
        
    except Exception as e:
        print(f"Error merging studies: {str(e)}")
        if not dry_run:
            db.session.rollback()
        return None

def check_duplicates(bs, doi=None, pmid=None, pmcid=None):
    """
    Find all related studies and determine best merge target
    
    Args:
        bs: BaseStudy object to check against
        doi: DOI to check
        pmid: PMID to check
        pmcid: PMCID to check
        
    Returns:
        Tuple[BaseStudy, list]: (Best study to merge into, List of studies to merge)
    """
    if not any([doi, pmid, pmcid]):
        return None, []
        
    # Find all studies sharing any identifiers
    queries = []
    if pmid:
        queries.append(BaseStudy.pmid == pmid)
    if doi:
        queries.append(BaseStudy.doi == doi)
    if pmcid:
        queries.append(BaseStudy.pmcid == pmcid)
        
    # Get all related studies
    all_studies = BaseStudy.query.filter(or_(*queries)).all()
    
    if not all_studies:
        return None, []
        
    # Include original study in candidates if not found in query
    if bs not in all_studies:
        all_studies.append(bs)
        
    print(f"Found {len(all_studies)} related studies")
    
    # Group studies by identifier combinations
    id_groups = {
        'doi_pmid': [],    # Has both DOI and PMID (preferred)
        'single_id': [],    # Has only one identifier
        'multiple_id': []   # Has multiple identifiers but not DOI+PMID
    }
    
    for study in all_studies:
        if study.doi and study.pmid:
            id_groups['doi_pmid'].append(study)
        elif sum([bool(study.doi), bool(study.pmid), bool(study.pmcid)]) > 1:
            id_groups['multiple_id'].append(study)
        else:
            id_groups['single_id'].append(study)
            
    # Score function for ranking studies
    def score_study(s):
        return sum([
            bool(s.name),
            bool(s.description),
            bool(s.publication),
            bool(s.year and s.year > 1900),
            bool(s.authors),
            bool(s.pmid),
            bool(s.doi),
            bool(s.pmcid),
            len(s.versions) # Prefer studies with more versions
        ])
    
    # Find best target
    best_target = None
    
    # First try studies with both DOI and PMID
    if id_groups['doi_pmid']:
        print("Found studies with both DOI and PMID")
        best_target = max(id_groups['doi_pmid'], key=score_study)
    # Then try studies with multiple identifiers
    elif id_groups['multiple_id']:
        print("Found studies with multiple identifiers")
        best_target = max(id_groups['multiple_id'], key=score_study)
    # Finally consider all studies
    else:
        print("Comparing all studies")
        best_target = max(all_studies, key=score_study)
        
    print(f"Selected study {best_target.id} as merge target")
    print(f"Target score: {score_study(best_target)}")
    print(f"Target identifiers: PMID={best_target.pmid}, DOI={best_target.doi}, PMCID={best_target.pmcid}")
    print(f"Target has {len(best_target.versions)} versions")
    
    # All other studies should be merged into target
    others = [s for s in all_studies if s.id != best_target.id]
    
    print(f"Found {len(others)} other studies to merge")
    for study in others:
        print(f"Study {study.id}: score={score_study(study)}, versions={len(study.versions)}")
        
    return best_target, others

def clean_base_studies_without_identifiers(dry_run=True):
    """
    Find and update studies missing identifiers
    
    Args:
        dry_run: If True, don't commit changes, just return what would change
    
    Returns:
        Dict with lists of objects to delete/commit if dry_run=True
    """
    print("\nProcessing studies with no identifiers...")
    
    changes = {
        'to_delete': [],
        'to_commit': []
    }

    # Get studies with no identifiers
    no_ids = BaseStudy.query.filter(
        and_(
            or_(BaseStudy.pmid == None, BaseStudy.pmid == ''),
            or_(BaseStudy.doi == None, BaseStudy.doi == ''),
            or_(BaseStudy.pmcid == None, BaseStudy.pmcid == '')
        )
    ).options(joinedload(BaseStudy.versions)).all()

    print(f"Found {len(no_ids)} studies with missing identifiers")
    
    updates = 0
    skipped = 0
    merged = 0
    failed = 0
    
    for bs in no_ids:
        if not bs.name or len(clean_string(bs.name)) < 10:
            skipped += 1
            continue
            
        print(f"\nProcessing: {bs.name}")
        
        # Search for study
        metadata = find_study(query=bs.name)
        if not metadata:
            print("No matching study found")
            skipped += 1
            continue
            
        # Check for duplicates and find best merge target
        best_target, others = check_duplicates(
            bs,
            doi=metadata.get('doi'),
            pmid=metadata.get('pmid'),
            pmcid=metadata.get('pmcid')
        )
        
        if best_target:
            print(f"Found {len(others)} studies to merge")
            if best_target.id != bs.id:
                print(f"Using study {best_target.id} as merge target (has fuller metadata)")
                
            # Merge using best target
            merge_result = merge_studies(best_target, others, metadata, dry_run=dry_run)
            if merge_result:
                if dry_run:
                    changes['to_delete'].extend(merge_result['to_delete'])
                    changes['to_commit'].extend(merge_result['to_commit'])
                merged += len(others)
                print("Successfully merged studies")
            else:
                failed += 1
                print("Failed to merge studies")
        else:
            # Just update this study 
            try:
                # Update metadata
                if metadata.get('title') and not bs.name:
                    bs.name = metadata['title']
                if metadata.get('description') and not bs.description:
                    bs.description = metadata['description']
                if metadata.get('journal') and not bs.publication:
                    bs.publication = metadata['journal']
                if metadata.get('year') and (not bs.year or bs.year <= 1900):
                    bs.year = metadata['year']
                if metadata.get('authors') and not bs.authors:
                    bs.authors = metadata['authors']
                    
                # Update identifiers
                if metadata.get('pmid'):
                    bs.pmid = metadata['pmid']
                if metadata.get('doi'):
                    bs.doi = metadata['doi']
                if metadata.get('pmcid'):
                    bs.pmcid = metadata['pmcid']
                    
                changes['to_commit'].append(bs)
                
                # Update versions
                for v in bs.versions:
                    if metadata.get('title') and not v.name:
                        v.name = metadata['title']
                    if metadata.get('description') and not v.description:
                        v.description = metadata['description']
                    if metadata.get('journal') and not v.publication:
                        v.publication = metadata['journal']
                    if metadata.get('year') and (not v.year or v.year <= 1900):
                        v.year = metadata['year']
                    if metadata.get('authors') and not v.authors:
                        v.authors = metadata['authors']
                        
                    if metadata.get('pmid'):
                        v.pmid = metadata['pmid']
                    if metadata.get('doi'):
                        v.doi = metadata['doi']
                    if metadata.get('pmcid'):
                        v.pmcid = metadata['pmcid']
                        
                    changes['to_commit'].append(v)
                    
                if not dry_run:
                    db.session.add_all([bs] + bs.versions)
                    db.session.commit()
                updates += 1
                print("Successfully updated study")
                
            except Exception as e:
                print(f"Error updating study: {str(e)}")
                if not dry_run:
                    db.session.rollback()
                failed += 1

    print(f"\nProcessed {len(no_ids)} studies:")
    print(f"Updated: {updates}")
    print(f"Merged: {merged}")
    print(f"Skipped: {skipped}")
    print(f"Failed: {failed}")
    
    if dry_run:
        return changes

def clean_studies_with_bad_metadata(dry_run=True):
    """
    Clean up studies with identifiers but missing other metadata.
    Carefully tracks which studies and versions actually need updates.
    
    Args:
        dry_run: If True, don't commit changes, just return what would change
    
    Returns:
        Dict with lists of objects to delete/commit if dry_run=True
    """
    print("\nProcessing studies with incomplete metadata...")
    
    changes = {
        'to_delete': [],
        'to_commit': [],
        'updated': {
            'studies': 0,
            'versions': 0
        }
    }

    # Find studies with at least one identifier but missing metadata
    studies = BaseStudy.query.filter(
        and_(
            or_(  # Has at least one valid identifier
                and_(BaseStudy.pmid != None, BaseStudy.pmid != ''),
                and_(BaseStudy.doi != None, BaseStudy.doi != ''),
                and_(BaseStudy.pmcid != None, BaseStudy.pmcid != '')
            ),
            or_(  # But missing or invalid metadata
                BaseStudy.name == None,
                BaseStudy.name == '',
                func.trim(BaseStudy.name) == '',
                BaseStudy.description == None,
                BaseStudy.description == '',
                func.trim(BaseStudy.description) == '',
                BaseStudy.publication == None,
                BaseStudy.publication == '',
                func.trim(BaseStudy.publication) == '',
                BaseStudy.year == None,
                BaseStudy.year <= 1900,
                BaseStudy.authors == None,
                BaseStudy.authors == '',
                func.trim(BaseStudy.authors) == ''
            )
        )
    ).options(joinedload(BaseStudy.versions)).all()

    print(f"Found {len(studies)} studies with incomplete metadata")
    
    updates = 0
    skipped = 0
    failed = 0
    merged = 0
    
    for bs in studies:
        print(f"\nProcessing study {bs.id}")
        
        # Try to find complete metadata
        metadata = None
        if bs.pmid:
            metadata = find_study(pmid=bs.pmid)
        if not metadata and bs.doi:
            metadata = find_study(doi=bs.doi)
            
        if not metadata:
            print("Could not find metadata")
            skipped += 1
            continue
        
        # Check for duplicates and find best merge target
        best_target, others = check_duplicates(
            bs,
            doi=metadata.get('doi'),
            pmid=metadata.get('pmid'),
            pmcid=metadata.get('pmcid')
        )
        
        if best_target:
            print(f"Found {len(others)} studies to merge")
            if best_target.id != bs.id:
                print(f"Using study {best_target.id} as merge target (has fuller metadata)")
                
            # Merge using best target
            merge_result = merge_studies(best_target, others, metadata, dry_run=dry_run)
            if merge_result:
                if dry_run:
                    changes['to_delete'].extend(merge_result['to_delete'])
                    changes['to_commit'].extend(merge_result['to_commit'])
                merged += len(others)
                print("Successfully merged studies")
            else:
                failed += 1
                print("Failed to merge studies")
        else:            
            try:
                # Update missing metadata
                if metadata.get('title') and not bs.name:
                    bs.name = metadata['title']
                if metadata.get('description') and not bs.description:
                    bs.description = metadata['description']
                if metadata.get('journal') and not bs.publication:
                    bs.publication = metadata['journal']
                if metadata.get('year') and (not bs.year or bs.year <= 1900):
                    bs.year = metadata['year']
                if metadata.get('authors') and not bs.authors:
                    bs.authors = metadata['authors']
                    
                # Add any missing identifiers
                if metadata.get('pmid') and not bs.pmid:
                    bs.pmid = metadata['pmid']
                if metadata.get('doi') and not bs.doi:
                    bs.doi = metadata['doi']
                if metadata.get('pmcid') and not bs.pmcid:
                    bs.pmcid = metadata['pmcid']
                    
                changes['to_commit'].append(bs)
                    
                # Update versions
                for v in bs.versions:
                    if metadata.get('title') and not v.name:
                        v.name = metadata['title']
                    if metadata.get('description') and not v.description:
                        v.description = metadata['description']
                    if metadata.get('journal') and not v.publication:
                        v.publication = metadata['journal']
                    if metadata.get('year') and (not v.year or v.year <= 1900):
                        v.year = metadata['year']
                    if metadata.get('authors') and not v.authors:
                        v.authors = metadata['authors']
                        
                    if metadata.get('pmid') and not v.pmid:
                        v.pmid = metadata['pmid']
                    if metadata.get('doi') and not v.doi:
                        v.doi = metadata['doi']
                    if metadata.get('pmcid') and not v.pmcid:
                        v.pmcid = metadata['pmcid']
                        
                    changes['to_commit'].append(v)
                    
                if not dry_run:
                    db.session.add_all([bs] + bs.versions)
                    db.session.commit()
                updates += 1
                print("Successfully updated metadata")
                
            except Exception as e:
                print(f"Error updating metadata: {str(e)}")
                if not dry_run:
                    db.session.rollback()
                failed += 1

    print(f"\nProcessed {len(studies)} studies:")
    print(f"Updated: {updates}")
    print(f"Merged: {merged}")
    print(f"Skipped: {skipped}")
    print(f"Failed: {failed}")
    
    if dry_run:
        return changes

def main():
    """Main function to clean the database"""
    try:
        print("Starting database cleanup...")
        
        # Default to dry run
        dry_run = True
        
        # Record all changes
        changes = {
            'to_delete': [],
            'to_commit': []
        }
        
        # Step 1: Find and add missing identifiers
        result = clean_base_studies_without_identifiers(dry_run=dry_run)
        if result:
            changes['to_delete'].extend(result['to_delete'])
            changes['to_commit'].extend(result['to_commit'])
        
        # Step 2: Clean up metadata for studies with identifiers
        result = clean_studies_with_bad_metadata(dry_run=dry_run)
        if result:
            changes['to_delete'].extend(result['to_delete'])
            changes['to_commit'].extend(result['to_commit'])
            
        # Print summary of changes
        print("\nChanges to make:")
        print(f"Objects to delete: {len(changes['to_delete'])}")
        print(f"Objects to update/add: {len(changes['to_commit'])}")
        
        print("\nDatabase cleanup planning complete!")
        
        return changes
        
    except Exception as e:
        print(f"\nError occurred: {str(e)}")
        raise

if __name__ == "__main__":
    changes = main()

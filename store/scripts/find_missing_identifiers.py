from Bio import Entrez
from sqlalchemy import and_, or_
from neurostore.models.data import BaseStudy, Study
from neurostore.database import db
import re
import time
import requests
from urllib.parse import quote

# Configure Entrez email (required for NCBI API access)
Entrez.email = "jamesdkent21@gmail.com"

def exponential_backoff_request(url, max_retries=5, initial_delay=1):
    """
    Make a request with exponential backoff for rate limiting
    
    Args:
        url: URL to request
        max_retries: Maximum number of retry attempts
        initial_delay: Initial delay in seconds
        
    Returns:
        Response object if successful, None if all retries failed
    """
    delay = initial_delay
    for attempt in range(max_retries):
        try:
            response = requests.get(url)
            if response.status_code == 429:  # Too Many Requests
                if attempt == max_retries - 1:  # Last attempt
                    print(f"Rate limit exceeded after {max_retries} retries")
                    return None
                    
                wait_time = delay * (2 ** attempt)  # Exponential backoff
                print(f"Rate limit hit, waiting {wait_time} seconds...")
                time.sleep(wait_time)
                continue
                
            response.raise_for_status()
            return response
            
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:  # Last attempt
                print(f"Request failed after {max_retries} retries: {str(e)}")
                return None
            time.sleep(delay * (2 ** attempt))
            
    return None

def clean_string(s):
    """Remove punctuation and convert to lowercase for matching"""
    if not s:
        return ""
    return re.sub(r'[^\w\s]', '', s).lower().strip()

def titles_match(title1, title2, threshold=0.9):
    """
    Compare two titles after cleaning and return True if they are similar enough.
    Uses character ratio comparison for fuzzy matching.
    """
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

def search_semantic_scholar(title):
    """Search Semantic Scholar API for a paper using title."""
    try:
        url = f"https://api.semanticscholar.org/graph/v1/paper/search?query={quote(title)}&fields=abstract,externalIds"
        response = exponential_backoff_request(url)
        
        if not response:
            return None
            
        data = response.json()
        if not data.get('data'):
            return None
            
        # Check each result for title match
        for paper in data['data']:
            if titles_match(title, paper.get('title', '')):
                result = {}
                if 'externalIds' in paper:
                    ids = paper['externalIds']
                    if 'DOI' in ids:
                        result['doi'] = ids['DOI']
                    if 'PubMed' in ids:
                        result['pmid'] = ids['PubMed']
                    if 'PubMedCentral' in ids:
                        result['pmcid'] = ids['PubMedCentral']
                if paper.get('abstract'):
                    result['abstract'] = paper['abstract']
                return result if result else None
                
        return None
        
    except Exception as e:
        print(f"Error searching Semantic Scholar: {str(e)}")
        return None

def get_article_details(pmid):
    """Get full article details from PubMed by PMID"""
    try:
        handle = Entrez.efetch(db="pubmed", id=pmid, rettype="medline", retmode="xml")
        articles = Entrez.read(handle)['PubmedArticle']
        handle.close()
        
        if not articles:
            return None
            
        article = articles[0]
        
        # Extract article details
        result = {'pmid': pmid}
        
        # Get title
        article_data = article['MedlineCitation']['Article']
        result['title'] = article_data.get('ArticleTitle', '')
        
        # Get DOI and PMCID
        for id_obj in article['PubmedData'].get('ArticleIdList', []):
            if id_obj.attributes.get('IdType') == 'doi':
                result['doi'] = str(id_obj)
            elif id_obj.attributes.get('IdType') == 'pmc':
                result['pmcid'] = str(id_obj)
                
        return result
        
    except Exception as e:
        print(f"Error fetching article details: {str(e)}")
        return None

def search_pubmed(title, authors=None):
    """
    Search PubMed for a paper using title and optionally authors
    Returns a dict with pmid, doi, and pmcid if found
    """
    try:
        # Construct search query
        query = f'{title}[Title]'
        if authors:
            # Add first author to query to improve accuracy
            first_author = authors.split(';')[0].split(',')[0].strip()
            query += f' AND "{first_author}"[Author]'

        # Search PubMed
        handle = Entrez.esearch(db="pubmed", term=query, retmax=5)
        record = Entrez.read(handle)
        handle.close()

        if not record['IdList']:
            return None

        # Check each result for title match
        for pmid in record['IdList']:
            article = get_article_details(pmid)
            if not article:
                continue
                
            # Verify title match
            if titles_match(title, article['title']):
                return article
                
        return None

    except Exception as e:
        print(f"Error searching PubMed: {str(e)}")
        return None

def find_existing_study(result):
    """
    Check if a study with any of the found identifiers already exists
    Returns the existing study if found, None otherwise
    """
    if not result:
        return None
        
    query = []
    if result.get('pmid'):
        query.append(BaseStudy.pmid == result['pmid'])
    if result.get('doi'):
        query.append(BaseStudy.doi == result['doi'])
    if result.get('pmcid'):
        query.append(BaseStudy.pmcid == result['pmcid'])
        
    if not query:
        return None
        
    return BaseStudy.query.filter(or_(*query)).first()

def verify_merge(source_study_id, target_study):
    """
    Verify that all versions were properly moved to the target study
    
    Args:
        source_study_id: ID of the original base study
        target_study: BaseStudy object versions were moved to
        
    Returns:
        bool: True if merge was successful, False otherwise
    """
    # Find any orphaned studies (still pointing to old base_study_id)
    orphaned = Study.query.filter_by(base_study_id=source_study_id).count()
    if orphaned > 0:
        print(f"Warning: {orphaned} studies still reference old base study {source_study_id}")
        return False
        
    # Verify versions were moved to target
    moved = Study.query.filter_by(base_study_id=target_study.id).count()
    if moved == 0:
        print(f"Warning: No studies found under target base study {target_study.id}")
        return False
        
    return True

def merge_base_studies(source_study, target_study, identifiers):
    """
    Merge source base study into target base study, moving all versions
    and updating with new identifiers
    
    Args:
        source_study: The BaseStudy to merge from
        target_study: The BaseStudy to merge into
        identifiers: Dict containing pmid, doi, pmcid to update with
    
    Returns:
        Tuple[bool, list]: (success status, list of objects to commit)
    """
    try:
        to_commit = []
        source_id = source_study.id
        version_count = len(source_study.versions)
        
        print(f"Moving {version_count} versions from {source_id} to {target_study.id}")
        
        # Update target study with any missing identifiers
        if identifiers.get('pmid') and not target_study.pmid:
            target_study.pmid = identifiers['pmid']
            to_commit.append(target_study)
        if identifiers.get('doi') and not target_study.doi:
            target_study.doi = identifiers['doi']
            to_commit.append(target_study)
        if identifiers.get('pmcid') and not target_study.pmcid:
            target_study.pmcid = identifiers['pmcid']
            to_commit.append(target_study)
            
        # Move all versions from source to target
        for version in source_study.versions:
            # Update version identifiers
            if identifiers.get('pmid'):
                version.pmid = identifiers['pmid']
            if identifiers.get('doi'):
                version.doi = identifiers['doi']
            if identifiers.get('pmcid'):
                version.pmcid = identifiers['pmcid']
            
            # Add to target study's versions
            target_study.versions.append(version)
            # Update base_study_id
            version.base_study_id = target_study.id
            
            to_commit.append(version)
            
        # Flush changes to verify merge
        db.session.add_all(to_commit)
        db.session.flush()
        
        # Verify versions were moved successfully
        if not verify_merge(source_id, target_study):
            db.session.rollback()
            return False, []
            
        # Mark source study for deletion after successful merge
        db.session.delete(source_study)
        
        return True, to_commit
        
    except Exception as e:
        print(f"Error during merge: {str(e)}")
        db.session.rollback()
        return False, []

def find_missing_identifiers():
    """Find and update studies missing identifiers"""
    
    print("Starting identifier search...")

    # Get studies with no identifiers
    no_ids = BaseStudy.query.filter(
        and_(
            or_(BaseStudy.pmid == None, BaseStudy.pmid == ''),
            or_(BaseStudy.doi == None, BaseStudy.doi == ''),
            or_(BaseStudy.pmcid == None, BaseStudy.pmcid == '')
        )
    ).all()

    print(f"Found {len(no_ids)} studies with missing identifiers")
    
    updates = 0
    skipped = 0
    merged = 0
    merge_failed = 0
    to_commit = []
    
    for bs in no_ids:
        if not bs.name:  # Skip if no title to search with
            skipped += 1
            continue
            
        # Clean title for searching
        clean_title = clean_string(bs.name)
        if len(clean_title) < 10:  # Skip very short titles
            skipped += 1
            continue
            
        print(f"\nSearching for: {bs.name}")
        
        # Try PubMed first
        result = search_pubmed(bs.name)
        
        # If not found in PubMed, try Semantic Scholar
        if not result:
            print("Not found in PubMed, trying Semantic Scholar...")
            result = search_semantic_scholar(bs.name)
        
        if result:
            # Check if study already exists with these identifiers
            existing = find_existing_study(result)
            if existing and existing.id != bs.id:
                print(f"Found existing study with matching identifiers (ID: {existing.id})")
                print("Merging studies...")
                
                # If we got an abstract from Semantic Scholar, save it
                if result.get('abstract') and not existing.description:
                    existing.description = result['abstract']
                
                # Merge the studies
                success, merge_updates = merge_base_studies(bs, existing, result)
                if success:
                    to_commit.extend(merge_updates)
                    merged += 1
                    print("Merge successful")
                else:
                    merge_failed += 1
                    print("Merge failed")
                continue
                
            # Update base study
            if result.get('pmid'):
                bs.pmid = result['pmid']
            if result.get('doi'):
                bs.doi = result['doi']
            if result.get('pmcid'):
                bs.pmcid = result['pmcid']
            if result.get('abstract') and not bs.description:
                bs.description = result['abstract']
                
            # Update all versions
            for v in bs.versions:
                if result.get('pmid'):
                    v.pmid = result['pmid']
                if result.get('doi'):
                    v.doi = result['doi']
                if result.get('pmcid'):
                    v.pmcid = result['pmcid']
                    
            to_commit.append(bs)
            updates += 1
            
            print(f"Found identifiers: {result}")
        else:
            print("No matching article found in either PubMed or Semantic Scholar")
            skipped += 1
    
    print(f"\nFound {updates} studies to update")
    print(f"Successfully merged {merged} duplicate studies")
    print(f"Failed to merge {merge_failed} studies")
    print(f"Skipped {skipped} studies (no title, title too short, or no match found)")
    
    return to_commit

if __name__ == "__main__":
    try:
        # Start transaction
        db.session.begin()
        
        # Find studies to update
        to_commit = find_missing_identifiers()
        
        # Return list of studies to update
        if to_commit:
            print(f"\nFound {len(to_commit)} studies to update")
        else:
            print("\nNo studies to update")
            
    except Exception as e:
        print(f"\nError occurred: {str(e)}")
        raise
    finally:
        print("Identifier search complete!")

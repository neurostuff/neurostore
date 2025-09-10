from Bio import Entrez
from Bio.Entrez.Parser import ValidationError
from sqlalchemy import func, or_
from neurostore.models.data import BaseStudy
from neurostore.database import db
from sqlalchemy.orm import joinedload

# Configure Entrez email (required for NCBI API access)
Entrez.email = "jamesdkent21@gmail.com"

# Chunk size for batching PubMed requests
CHUNK_SIZE = 900

def get_publication_year(pmid):
    """
    Retrieves the publication year for a given PMID using BioPython.

    Args:
    - pmid (str): PubMed ID (PMID) of the publication.

    Returns:
    - int or None: The publication year if found, otherwise None.
    """
    try:
        handle = Entrez.efetch(db="pubmed", id=pmid, rettype="medline", retmode="text")
        record = handle.read()
        handle.close()

        # Extract publication year from the record
        lines = record.splitlines()
        for line in lines:
            if line.startswith("DP  - "):
                year_str = line[6:10]
                try:
                    return int(year_str)
                except ValueError:
                    return None
        return None

    except (ValidationError, Exception) as e:
        print(f"Error retrieving publication year: {str(e)}")
        return None

def get_journal_names(bss):
    """
    Retrieves and updates journal names for a list of studies using BioPython.

    Args:
    - bss (list): List of BaseStudy objects

    Returns:
    - list: List of objects to commit to database
    """
    to_commit = []
    try:
        pmid_dict = {bs.pmid: bs for bs in bss}
        pmids_str = ",".join(list(pmid_dict.keys()))

        handle = Entrez.efetch(db="pubmed", id=pmids_str, rettype="medline", retmode="text")
        records = handle.read()
        handle.close()

        entries = records.split("\n\n")
        for entry in entries:
            lines = entry.splitlines()
            pmid = None
            journal_name = None
            for line in lines:
                if line.startswith("PMID- "):
                    pmid = line[6:]
                elif line.startswith("JT  - "):
                    journal_name = line[6:]
            if pmid and journal_name:
                bs = pmid_dict[pmid]
                bs.publication = journal_name
                to_commit.append(bs)
                for v in bs.versions:
                    v.publication = journal_name
                    to_commit.append(v)
        
        return to_commit
    
    except Exception as e:
        print(f"Error retrieving journal names: {str(e)}")
        return []

def get_abstracts(bss):
    """
    Retrieves and updates abstracts for a list of studies using BioPython.

    Args:
    - bss (list): List of BaseStudy objects

    Returns:
    - list: List of objects to commit to database
    """
    to_commit = []
    try:
        pmid_dict = {bs.pmid: bs for bs in bss}
        pmids_str = ",".join(list(pmid_dict.keys()))

        handle = Entrez.efetch(db="pubmed", id=pmids_str, rettype="medline", retmode="text")
        records = handle.read()
        handle.close()

        entries = records.split("\n\n")
        for entry in entries:
            lines = entry.splitlines()
            pmid = None
            abstract_lines = []
            in_abstract = False
            
            for line in lines:
                if line.startswith("PMID- "):
                    pmid = line[6:]
                elif line.startswith("AB  - "):
                    in_abstract = True
                    abstract_lines.append(line[6:])
                elif in_abstract and line.startswith("      "):
                    abstract_lines.append(line[6:])
                elif in_abstract:
                    in_abstract = False
            
            if pmid and abstract_lines:
                abstract = " ".join(abstract_lines)
                bs = pmid_dict[pmid]
                bs.description = abstract
                to_commit.append(bs)
                for v in bs.versions:
                    v.description = abstract
                    to_commit.append(v)
                    
        return to_commit

    except Exception as e:
        print(f"Error retrieving abstracts: {str(e)}")
        return []

def get_author_names(bss):
    """
    Retrieves and updates author names for a list of studies using BioPython.

    Args:
    - bss (list): List of BaseStudy objects

    Returns:
    - list: List of objects to commit to database
    """
    to_commit = []
    try:
        pmid_dict = {bs.pmid: bs for bs in bss}
        pmids_str = ",".join(list(pmid_dict.keys()))

        handle = Entrez.efetch(db="pubmed", id=pmids_str, rettype="medline", retmode="text")
        records = handle.read()
        handle.close()

        entries = records.split("\n\n")
        for entry in entries:
            lines = entry.splitlines()
            pmid = None
            authors = []
            for line in lines:
                if line.startswith("PMID- "):
                    pmid = line[6:]
                elif line.startswith("FAU - "):
                    authors.append(line[6:])
            if pmid and authors:
                authors = ";".join(authors)
                bs = pmid_dict[pmid]
                bs.authors = authors
                to_commit.append(bs)
                for v in bs.versions:
                    v.authors = authors
                    to_commit.append(v)
                    
        return to_commit

    except Exception as e:
        print(f"Error retrieving author names: {str(e)}")
        return []

def cleanup_publications():
    """Main function to clean up publication data"""
    
    print("Starting publication cleanup...")
    
    # Fix publication years
    values_to_check = [None, 0, 1, 3, 9, 13, 16, 19]
    bad_year = BaseStudy.query.filter(
        or_(BaseStudy.year==None, BaseStudy.year<=1900)
    ).filter(BaseStudy.pmid != None).all()
    
    print(f"Found {len(bad_year)} studies with invalid years")
    
    # Update years
    to_commit = []
    for bs in bad_year:
        year = get_publication_year(bs.pmid)
        if not year:
            print(f"NO YEAR FOR {bs.pmid}")
            continue
        bs.year = year
        to_commit.append(bs)
        for v in bs.versions:
            v.year = year
            to_commit.append(v)
    
    if to_commit:
        db.session.add_all(to_commit)
        db.session.commit()
        print(f"Updated {len(to_commit)} records with correct years")

    # Fix missing journals
    bad_journal = BaseStudy.query.filter(
        or_(BaseStudy.publication==None, 
            BaseStudy.publication=='', 
            func.trim(BaseStudy.publication)=='')
    ).filter(BaseStudy.pmid != None).options(joinedload(BaseStudy.versions)).all()
    
    print(f"Found {len(bad_journal)} studies with missing journals")
    
    # Process journals in chunks
    to_commit = []
    chunks = [bad_journal[i:i+CHUNK_SIZE] for i in range(0, len(bad_journal), CHUNK_SIZE)]
    for chunk in chunks:
        to_commit.extend(get_journal_names(chunk))
    
    if to_commit:
        db.session.add_all(to_commit)
        db.session.commit()
        print(f"Updated {len(to_commit)} records with journal information")

    # Fix missing authors
    bad_authors = BaseStudy.query.filter(
        or_(BaseStudy.authors==None,
            BaseStudy.authors=='',
            func.trim(BaseStudy.authors)=='')
    ).filter(BaseStudy.pmid != None).options(joinedload(BaseStudy.versions)).all()
    
    print(f"Found {len(bad_authors)} studies with missing authors")
    
    # Process authors in chunks
    to_commit = []
    chunks = [bad_authors[i:i+CHUNK_SIZE] for i in range(0, len(bad_authors), CHUNK_SIZE)]
    for chunk in chunks:
        to_commit.extend(get_author_names(chunk))
    
    if to_commit:
        db.session.add_all(to_commit)
        db.session.commit()
        print(f"Updated {len(to_commit)} records with author information")

    # Fix missing abstracts
    bad_abstracts = BaseStudy.query.filter(
        or_(BaseStudy.description==None,
            BaseStudy.description=='',
            func.trim(BaseStudy.description)=='')
    ).filter(BaseStudy.pmid != None).options(joinedload(BaseStudy.versions)).all()
    
    print(f"Found {len(bad_abstracts)} studies with missing abstracts")
    
    # Process abstracts in chunks
    to_commit = []
    chunks = [bad_abstracts[i:i+CHUNK_SIZE] for i in range(0, len(bad_abstracts), CHUNK_SIZE)]
    for chunk in chunks:
        to_commit.extend(get_abstracts(chunk))
    
    if to_commit:
        db.session.add_all(to_commit)
        db.session.commit()
        print(f"Updated {len(to_commit)} records with abstract information")

    print("Publication cleanup complete!")

if __name__ == "__main__":
    cleanup_publications()

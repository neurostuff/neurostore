// The same addresses the main web app links a study to (neurosynth-frontend's
// useFetchPubMedIds.types.ts and EditStudyPageHeaderNext.tsx).
export const PUBMED_ARTICLE_URL_PREFIX = 'https://pubmed.ncbi.nlm.nih.gov/';
export const PUBMED_CENTRAL_ARTICLE_URL_PREFIX = 'https://ncbi.nlm.nih.gov/pmc/articles/';

export interface PaperLink {
    label: string;
    href: string;
    title: string;
}

/** Links to read a paper: its DOI, its PubMed record, and its full text on PubMed Central. */
export function paperLinks({
    doi,
    pmid,
    pmcid,
}: {
    doi: string | null;
    pmid: string | null;
    pmcid: string | null;
}): PaperLink[] {
    const links: PaperLink[] = [];
    if (doi) links.push({ label: 'DOI', href: `https://doi.org/${doi}`, title: 'The publisher’s page' });
    if (pmid) links.push({ label: 'PubMed', href: `${PUBMED_ARTICLE_URL_PREFIX}${pmid}`, title: 'The PubMed record' });
    if (pmcid) {
        const id = /^\d+$/.test(pmcid) ? `PMC${pmcid}` : pmcid;
        links.push({
            label: 'Full text (PMC)',
            href: `${PUBMED_CENTRAL_ARTICLE_URL_PREFIX}${id}`,
            title: 'The full article in HTML on PubMed Central',
        });
    }
    return links;
}

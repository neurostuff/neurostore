import { ICurationStubStudy } from '../Curation.types';

/**
 * Filter excluded-study stubs by a case-insensitive substring match against the
 * bibliographic fields (title, authors, journal, year, keywords) and identifiers
 * (pmid, doi). An empty/whitespace term returns all stubs unchanged.
 */
export const filterStubsBySearch = (stubs: ICurationStubStudy[], searchTerm: string): ICurationStubStudy[] => {
    const term = searchTerm.trim().toLocaleLowerCase();
    if (!term) return stubs;
    return stubs.filter((stub) => {
        const haystack = [stub.title, stub.authors, stub.journal, stub.articleYear, stub.keywords, stub.pmid, stub.doi]
            .filter(Boolean)
            .join(' ')
            .toLocaleLowerCase();
        return haystack.includes(term);
    });
};

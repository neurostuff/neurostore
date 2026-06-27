import { stringToNumber } from 'helpers/utils';
import { INeurosynthParsedPubmedArticle } from 'hooks/external/useFetchPubMedIds.types';
import { BaseStudy } from 'neurostore-typescript-sdk';

export const applyPubmedStudyDetailsToBaseStudiesAndRemoveDuplicates = (
    baseStudySleuthStubs: BaseStudy[],
    pubmedStudies: INeurosynthParsedPubmedArticle[]
) => {
    const idToPubmedStudyMap = new Map<string, INeurosynthParsedPubmedArticle>();
    pubmedStudies.forEach((pubmedStudy) => {
        if (pubmedStudy.PMID) idToPubmedStudyMap.set(pubmedStudy.PMID, pubmedStudy);
        if (pubmedStudy.DOI) idToPubmedStudyMap.set(pubmedStudy.DOI, pubmedStudy);
    });

    const deduplicatedBaseStudiesWithDetails: BaseStudy[] = [];
    baseStudySleuthStubs.forEach((baseStudy) => {
        const associatedPubmedStudy =
            idToPubmedStudyMap.get(baseStudy.pmid || '') || idToPubmedStudyMap.get(baseStudy.doi || '');

        let updatedBaseStudyWithDetails: BaseStudy = {};
        if (!associatedPubmedStudy) {
            updatedBaseStudyWithDetails = { ...baseStudy };
        } else {
            const authorString = (associatedPubmedStudy?.authors || []).reduce(
                (prev, curr, index, arr) =>
                    `${prev}${curr.ForeName} ${curr.LastName}${index === arr.length - 1 ? '' : ', '}`,
                ''
            );
            const { isValid, value } = stringToNumber(associatedPubmedStudy?.articleYear || '');

            updatedBaseStudyWithDetails = {
                authors: baseStudy.authors ? baseStudy.authors : authorString,
                description: associatedPubmedStudy.abstractText,
                doi: baseStudy.doi ? baseStudy.doi : associatedPubmedStudy.DOI,
                pmcid: baseStudy.pmcid ? baseStudy.pmcid : associatedPubmedStudy.PMCID,
                name: baseStudy.name ? baseStudy.name : associatedPubmedStudy.title,
                pmid: baseStudy.pmid ? baseStudy.pmid : associatedPubmedStudy.PMID,
                publication: baseStudy.publication ? baseStudy.publication : associatedPubmedStudy.journal.title,
                year: baseStudy.year ? baseStudy.year : isValid ? value : undefined,
                level: 'group',
            };
        }

        const hasThisStudyAlready = deduplicatedBaseStudiesWithDetails.some(
            ({ doi, pmid }) =>
                (doi && doi === updatedBaseStudyWithDetails.doi) || (pmid && pmid === updatedBaseStudyWithDetails.pmid)
        );
        if (!hasThisStudyAlready) deduplicatedBaseStudiesWithDetails.push(updatedBaseStudyWithDetails);
    });
    return deduplicatedBaseStudiesWithDetails;
};

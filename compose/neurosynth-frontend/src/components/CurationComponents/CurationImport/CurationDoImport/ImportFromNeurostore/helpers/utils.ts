import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import { BaseStudyReturn } from 'neurostore-typescript-sdk';
import { defaultIdentificationSources } from 'pages/Projects/ProjectPage/ProjectStore.helpers';
import { v4 as uuidv4 } from 'uuid';

export const studiesToStubs = (
    searchTerm: string,
    studies: BaseStudyReturn[]
): ICurationStubStudy[] => {
    return studies.map((study) => {
        const doi = study?.doi || '';
        const pmid = study?.pmid || '';

        return {
            id: uuidv4(),
            title: study.name || '',
            authors: study.authors || '',
            keywords: '',
            pmcid: study.pmcid || '',
            pmid: pmid === 'NaN' ? '' : pmid,
            doi: doi === 'NaN' ? '' : doi,
            articleYear: study.year?.toString() || '',
            journal: study.publication || '',
            abstractText: study.description || '',
            articleLink: study.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${study.pmid}` : '',
            exclusionTag: null,
            identificationSource: defaultIdentificationSources.neurostore,
            tags: [],
            neurostoreId: study.id,
            searchTerm: searchTerm,
        };
    });
};

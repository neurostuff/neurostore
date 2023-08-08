import { ICurationStubStudy } from 'interfaces/project/curation.interface';
import { StudyReturn } from 'neurostore-typescript-sdk';
import { defaultIdentificationSources } from 'stores/ProjectStore.helpers';
import { v4 as uuidv4 } from 'uuid';

export const studiesToStubs = (studies: StudyReturn[]): ICurationStubStudy[] => {
    return studies.map((study) => {
        const doi = study?.doi || '';
        const pmid = study?.pmid || '';

        return {
            id: uuidv4(),
            title: study.name || '',
            authors: study.authors || '',
            keywords: '',
            pmid: pmid === 'NaN' ? '' : pmid,
            doi: doi === 'NaN' ? '' : doi,
            articleYear: `${study.year}`,
            journal: study.publication || '',
            abstractText: study.description || '',
            articleLink: study.pmid ? `https://pubmed.ncbi.nlm.nih.gov/${study.pmid}` : '',
            exclusionTag: null,
            import: {
                id: '',
                name: '',
                source: defaultIdentificationSources.neurostore,
            },
            tags: [],
            neurostoreId: study.id,
        };
    });
};

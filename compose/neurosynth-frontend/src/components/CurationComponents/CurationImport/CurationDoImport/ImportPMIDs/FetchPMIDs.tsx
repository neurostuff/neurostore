import { Box } from '@mui/material';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import useGetPubmedIDs from 'hooks/external/useGetPubMedIds';
import { defaultIdentificationSources } from 'pages/Projects/ProjectPage/ProjectStore.helpers';
import React from 'react';
import { useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

const FetchPMIDs: React.FC<{
    pubmedIds: string[];
    onStubsUploaded: (stubs: ICurationStubStudy[], unimportedStubs?: string[]) => void;
}> = React.memo((props) => {
    const { data, isLoading, isError, isSuccess } = useGetPubmedIDs(props.pubmedIds, true);

    useEffect(() => {
        if (data.length === 0 || isLoading || !isSuccess) return;
        const flattenedData = data.flat();

        let unimportedStubs;
        if (flattenedData.length !== props.pubmedIds.length) {
            unimportedStubs = [];
            const pmidSet = new Set(flattenedData.map((x) => x.PMID));
            props.pubmedIds.forEach((pmid) => {
                if (!pmidSet.has(pmid)) {
                    unimportedStubs.push(pmid);
                }
            });
        }

        const stubs = flattenedData.map((x) => {
            const authorString = (x?.authors || []).reduce(
                (prev, curr, index, arr) =>
                    `${prev}${curr.ForeName} ${curr.LastName}${
                        index === arr.length - 1 ? '' : ', '
                    }`,
                ''
            );

            const keywordsString = (x?.keywords || []).reduce((acc, curr, currIndex) => {
                if (currIndex === 0) {
                    return curr;
                } else {
                    return `${acc}, ${curr}`;
                }
            }, '');

            return {
                id: uuidv4(),
                title: x.title,
                authors: authorString,
                keywords: keywordsString,
                pmid: x.PMID,
                pmcid: x.PMCID,
                doi: x.DOI,
                journal: x.journal.title,
                articleYear: x.articleYear,
                abstractText: x.abstractText,
                articleLink: x.articleLink,
                exclusionTag: null,
                tags: [],
                identificationSource: defaultIdentificationSources.pubmed,
            } as ICurationStubStudy;
        });
        props.onStubsUploaded(stubs, unimportedStubs);
    }, [data, isLoading, isSuccess, props, props.onStubsUploaded]);

    return (
        <Box sx={{ margin: '2rem 0' }}>
            <StateHandlerComponent
                loadingText="fetching pubmed studies"
                isLoading={isLoading}
                isError={isError}
            ></StateHandlerComponent>
        </Box>
    );
});

export default FetchPMIDs;

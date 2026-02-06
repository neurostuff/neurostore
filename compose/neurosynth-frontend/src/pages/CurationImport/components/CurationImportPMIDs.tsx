import { Box } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useFetchPubMedIds } from 'hooks';
import { useSnackbar } from 'notistack';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { defaultIdentificationSources } from 'pages/Project/store/ProjectStore.types';
import React from 'react';
import { v4 as uuidv4 } from 'uuid';
import { IImportArgs } from './CurationImportDoImport';
import CurationImportPMIDsUpload from './CurationImportPMIDsUpload';

const CurationImportPMIDs: React.FC<IImportArgs & { onFileUpload: (fileName: string) => void }> = ({
    onNavigate,
    onImportStubs,
    onFileUpload,
}) => {
    const { mutate: fetchPubMedIds, isLoading, isError } = useFetchPubMedIds();
    const { enqueueSnackbar } = useSnackbar();

    const handlePubmedIdsUploaded = (parsedIds: string[]) => {
        fetchPubMedIds(parsedIds, {
            onSuccess: (data) => {
                let unimportedStubs;
                if (data.length !== parsedIds.length) {
                    unimportedStubs = [];
                    const pmidSet = new Set(data.map((x) => x.PMID));
                    parsedIds.forEach((pmid) => {
                        if (!pmidSet.has(pmid)) {
                            unimportedStubs.push(pmid);
                        }
                    });
                }

                const stubs = data.map((x) => {
                    const authorString = (x?.authors || []).reduce(
                        (prev, curr, index, arr) =>
                            `${prev}${curr.ForeName} ${curr.LastName}${index === arr.length - 1 ? '' : ', '}`,
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
                handleOnStubsUploaded(stubs, unimportedStubs);
            },
            onError: () => {
                enqueueSnackbar('There was an error fetching the pubmed studies. Please try again.', {
                    variant: 'error',
                });
            },
        });
    };

    const handleOnStubsUploaded = (uploadedStubs: ICurationStubStudy[], unimportedStubs?: string[]) => {
        onImportStubs(uploadedStubs, unimportedStubs);
        onNavigate(ENavigationButton.NEXT);
    };

    return (
        <Box sx={{ margin: '2rem 0' }}>
            <StateHandlerComponent
                loadingText="Fetching pubmed studies (depending on the number of studies, this may take a while)"
                isLoading={isLoading}
                isError={isError}
            >
                <CurationImportPMIDsUpload
                    onNavigate={onNavigate}
                    onFileUpload={onFileUpload}
                    onPubmedIdsUploaded={handlePubmedIdsUploaded}
                />
            </StateHandlerComponent>
        </Box>
    );
};

export default CurationImportPMIDs;

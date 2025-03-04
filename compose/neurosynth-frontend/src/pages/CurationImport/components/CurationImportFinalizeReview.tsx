import { Box, Divider, Paper, Typography } from '@mui/material';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import useGetWindowHeight from 'hooks/useGetWindowHeight';
import { useMemo } from 'react';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import CurationImportFinalizeReviewVirtualizedListItem from './CurationImportFinalizeReviewVirtualizedListItem';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import React from 'react';

const CurationImportFinalizeReviewFixedSizeListRow: React.FC<
    ListChildComponentProps<{
        stubs: ICurationStubStudy[];
    }>
> = (props) => {
    const stub = props.data.stubs[props.index];

    return <CurationImportFinalizeReviewVirtualizedListItem {...stub} style={props.style} />;
};

const LIST_HEIGHT = 95;

const CurationImportFinalizeReview: React.FC<{
    stubs: ICurationStubStudy[];
    unimportedStubs: string[];
}> = React.memo((props) => {
    const { stubs, unimportedStubs } = props;
    const nonExcludedStubs = useMemo(() => {
        return stubs.filter((x) => !x.exclusionTag);
    }, [stubs]);
    const excludedStubs = useMemo(() => {
        return stubs.filter((x) => !!x.exclusionTag);
    }, [stubs]);

    const windowHeight = useGetWindowHeight();

    const includedStudiesListHeight = useMemo(() => {
        const estimatedListHeight = LIST_HEIGHT * nonExcludedStubs.length;
        const defaultListHeight = windowHeight - 200;
        const fixedListHeight = defaultListHeight > estimatedListHeight ? estimatedListHeight : defaultListHeight;

        return fixedListHeight;
    }, [nonExcludedStubs.length, windowHeight]);

    const excludedStudiesListHeight = useMemo(() => {
        const estimatedListHeight = LIST_HEIGHT * excludedStubs.length;
        const defaultListHeight = windowHeight - 200;
        const fixedListHeight = defaultListHeight > estimatedListHeight ? estimatedListHeight : defaultListHeight;

        return fixedListHeight;
    }, [excludedStubs.length, windowHeight]);

    return (
        <Box sx={{ marginBottom: '6rem' }}>
            <Paper sx={{ paddingTop: '0.5rem' }} elevation={0}>
                <Divider sx={{ margin: '0.5rem 0 1rem 0' }} />
                <Typography gutterBottom variant="h6">
                    Summary
                </Typography>
                {unimportedStubs.length > 0 && (
                    <>
                        <Typography color="error.main">
                            We encountered issues importing {props.unimportedStubs.length} studies. You may have to
                            create these studies manually:
                        </Typography>
                        <Typography color="error.main" gutterBottom>
                            {props.unimportedStubs.reduce((acc, curr, currIndex, arr) => {
                                return currIndex === arr.length - 1 ? `${acc}${curr}` : `${acc}${curr}, `;
                            }, '')}
                        </Typography>
                    </>
                )}
            </Paper>
            {nonExcludedStubs.length > 0 && (
                <Box sx={{ marginBottom: '1rem' }}>
                    <NeurosynthAccordion
                        expandIconColor={'success.main'}
                        sx={{
                            border: '1px solid',
                            borderColor: 'success.main',
                        }}
                        accordionSummarySx={{
                            ':hover': {
                                backgroundColor: '#f2f2f2',
                            },
                        }}
                        TitleElement={
                            <Typography sx={{ color: 'success.main' }}>
                                Click to view {nonExcludedStubs.length} imported studies
                            </Typography>
                        }
                        elevation={0}
                    >
                        <FixedSizeList
                            height={includedStudiesListHeight}
                            itemCount={nonExcludedStubs.length}
                            width="100%"
                            itemSize={LIST_HEIGHT}
                            itemKey={(index, data) => data.stubs[index]?.id}
                            layout="vertical"
                            itemData={{
                                stubs: nonExcludedStubs,
                            }}
                            overscanCount={3}
                        >
                            {CurationImportFinalizeReviewFixedSizeListRow}
                        </FixedSizeList>
                    </NeurosynthAccordion>
                </Box>
            )}
            {excludedStubs.length > 0 && (
                <Box sx={{ margin: '1.5rem 0' }}>
                    <NeurosynthAccordion
                        expandIconColor={'warning.dark'}
                        sx={{
                            border: '1px solid',
                            borderColor: 'warning.dark',
                        }}
                        accordionSummarySx={{
                            ':hover': {
                                backgroundColor: '#f2f2f2',
                            },
                        }}
                        TitleElement={
                            <Typography sx={{ color: 'warning.dark' }}>
                                Click to view {excludedStubs.length} duplicate studies
                            </Typography>
                        }
                        elevation={0}
                    >
                        <FixedSizeList
                            height={excludedStudiesListHeight}
                            itemCount={excludedStubs.length}
                            width="100%"
                            itemSize={LIST_HEIGHT}
                            itemKey={(index, data) => data.stubs[index]?.id}
                            layout="vertical"
                            itemData={{
                                stubs: excludedStubs,
                            }}
                            overscanCount={3}
                        >
                            {CurationImportFinalizeReviewFixedSizeListRow}
                        </FixedSizeList>
                    </NeurosynthAccordion>
                </Box>
            )}
        </Box>
    );
});

export default CurationImportFinalizeReview;

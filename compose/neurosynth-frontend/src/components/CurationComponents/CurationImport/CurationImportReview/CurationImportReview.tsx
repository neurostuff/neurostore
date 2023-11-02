import { Box, Paper, Typography } from '@mui/material';
import NavigationButtons, {
    ENavigationButton,
} from 'components/Buttons/NavigationButtons/NavigationButtons';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import useGetWindowHeight from 'hooks/useGetWindowHeight';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import ReadOnlyStubSummaryVirtualizedItem from './ReadOnlyStubSummaryVirtualizedItem';
import { useMemo } from 'react';

const CurationImportReviewFixedSizeListRow: React.FC<
    ListChildComponentProps<{
        stubs: ICurationStubStudy[];
    }>
> = (props) => {
    const stub = props.data.stubs[props.index];

    return <ReadOnlyStubSummaryVirtualizedItem {...stub} style={props.style} />;
};

const LIST_HEIGHT = 140;

const CurationImportReview: React.FC<{
    stubs: ICurationStubStudy[];
    unimportedStubs: string[];
    onNavigate: (button: ENavigationButton) => void;
}> = (props) => {
    const { stubs, onNavigate } = props;

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
        const fixedListHeight =
            defaultListHeight > estimatedListHeight ? estimatedListHeight : defaultListHeight;

        return fixedListHeight;
    }, [nonExcludedStubs.length, windowHeight]);

    const excludedStudiesListHeight = useMemo(() => {
        const estimatedListHeight = LIST_HEIGHT * excludedStubs.length;
        const defaultListHeight = windowHeight - 200;
        const fixedListHeight =
            defaultListHeight > estimatedListHeight ? estimatedListHeight : defaultListHeight;

        return fixedListHeight;
    }, [excludedStubs.length, windowHeight]);

    return (
        <>
            <Paper elevation={0}>
                <Box sx={{ paddingTop: '0.5rem' }}>
                    <Typography gutterBottom sx={{ fontWeight: 'bold' }} variant="h6">
                        Importing {nonExcludedStubs.length} studies
                    </Typography>
                    {props.unimportedStubs.length > 0 && (
                        <>
                            <Typography color="warning.dark">
                                We encountered issues importing {props.unimportedStubs.length}{' '}
                                studies. You may have to create these studies manually:
                            </Typography>
                            <Typography color="warning.dark" gutterBottom>
                                {props.unimportedStubs.reduce((acc, curr, currIndex, arr) => {
                                    return currIndex === arr.length - 1
                                        ? `${acc}${curr}`
                                        : `${acc}${curr}, `;
                                }, '')}
                            </Typography>
                        </>
                    )}
                </Box>
            </Paper>
            <Box sx={{ margin: '1rem 0', backgroundColor: '#f6f6f6' }}>
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
                    {CurationImportReviewFixedSizeListRow}
                </FixedSizeList>
            </Box>
            {excludedStubs.length > 0 && (
                <Box sx={{ margin: '1.5rem 0' }}>
                    <NeurosynthAccordion
                        expandIconColor={'primary.main'}
                        sx={{
                            border: '1px solid',
                            borderColor: 'primary.main',
                        }}
                        accordionSummarySx={{
                            ':hover': {
                                backgroundColor: '#f2f2f2',
                            },
                        }}
                        TitleElement={
                            <Typography sx={{ color: 'primary.main' }}>
                                {excludedStubs.length} Duplicates
                            </Typography>
                        }
                        elevation={0}
                    >
                        <FixedSizeList
                            height={excludedStudiesListHeight}
                            itemCount={excludedStubs.length}
                            width="100%"
                            itemSize={150}
                            itemKey={(index, data) => data.stubs[index]?.id}
                            layout="vertical"
                            itemData={{
                                stubs: excludedStubs,
                            }}
                            overscanCount={3}
                        >
                            {CurationImportReviewFixedSizeListRow}
                        </FixedSizeList>
                    </NeurosynthAccordion>
                </Box>
            )}
            <NavigationButtons
                nextButtonStyle="contained"
                nextButtonDisabled={stubs.length === 0}
                onButtonClick={onNavigate}
            />
        </>
    );
};

export default CurationImportReview;

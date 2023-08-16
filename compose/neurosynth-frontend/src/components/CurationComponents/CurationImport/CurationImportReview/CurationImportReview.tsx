import { Box, Paper, Typography } from '@mui/material';
import NavigationButtons, {
    ENavigationButton,
} from 'components/Buttons/NavigationButtons/NavigationButtons';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import NeurosynthAccordion from 'components/NeurosynthAccordion/NeurosynthAccordion';
import useGetWindowHeight from 'hooks/useGetWindowHeight';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import ReadOnlyStubSummaryVirtualizedItem from './ReadOnlyStubSummaryVirtualizedItem';

const CurationImportReviewFixedSizeListRow: React.FC<
    ListChildComponentProps<{
        stubs: ICurationStubStudy[];
    }>
> = (props) => {
    const stub = props.data.stubs[props.index];

    return <ReadOnlyStubSummaryVirtualizedItem {...stub} style={props.style} />;
};

const CurationImportReview: React.FC<{
    stubs: ICurationStubStudy[];
    unimportedStubs: string[];
    onNavigate: (button: ENavigationButton) => void;
}> = (props) => {
    const { stubs, onNavigate } = props;

    const nonExcludedStubs = stubs.filter((x) => !x.exclusionTag);
    const excludedStubs = stubs.filter((x) => !!x.exclusionTag);

    const windowHeight = useGetWindowHeight();

    const fixedListHeight = windowHeight - 400 < 300 ? 300 : windowHeight - 400;

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
                    {/* <Typography sx={{ marginBottom: '0.5rem' }} variant="body1">
                        Tag all your imported studies
                    </Typography>
                    <Box>
                        <TagSelectorPopup
                            size="small"
                            sx={{ width: '500px' }}
                            onAddTag={handleAddTag}
                            onCreateTag={handleAddTag}
                        />
                        <Box sx={{ marginTop: '0.5rem' }}>
                            {tags.map((tag) => (
                                <Chip
                                    sx={{ margin: '3px' }}
                                    onDelete={() => handleDeleteTag(tag)}
                                    label={tag.label}
                                    key={tag.id}
                                />
                            ))}
                        </Box>
                    </Box> */}
                </Box>
                {/* <Divider sx={{ marginTop: '0.5rem' }} /> */}
            </Paper>
            <Box sx={{ margin: '1rem 0', backgroundColor: '#f6f6f6' }}>
                {/* <Typography sx={{ color: 'gray', fontStyle: 'italic' }}>
                    Studies marked as "Duplicate" have a red border
                </Typography> */}
                <FixedSizeList
                    height={fixedListHeight}
                    itemCount={nonExcludedStubs.length}
                    width="100%"
                    itemSize={150}
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
                            height={fixedListHeight}
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

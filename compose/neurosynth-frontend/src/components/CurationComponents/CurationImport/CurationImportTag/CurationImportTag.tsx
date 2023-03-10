import { Box, Chip, Divider, Paper, Typography } from '@mui/material';
import NavigationButtons, {
    ENavigationButton,
} from 'components/Buttons/NavigationButtons/NavigationButtons';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import TagSelectorPopup from 'components/CurationComponents/SelectorPopups/TagSelectorPopup/TagSelectorPopup';
import { ITag } from 'hooks/requests/useGetProjects';
import useGetWindowHeight from 'hooks/useGetWindowHeight';
import { FixedSizeList, ListChildComponentProps } from 'react-window';
import CurationImportTagStudyItem from './CurationImportTagStudyItem';

const CurationImportTagFixedSizeListRow: React.FC<
    ListChildComponentProps<{
        stubs: ICurationStubStudy[];
    }>
> = (props) => {
    const stub = props.data.stubs[props.index];

    return <CurationImportTagStudyItem {...stub} style={props.style} />;
};

const CurationImportTag: React.FC<{
    stubs: ICurationStubStudy[];
    onUpdateStubs: (stubs: ICurationStubStudy[]) => void;
    onNavigate: (button: ENavigationButton) => void;
}> = (props) => {
    const { stubs, onUpdateStubs, onNavigate } = props;

    const windowHeight = useGetWindowHeight();

    const handleAddTag = (tag: ITag) => {
        // check if tag exists already and if so, don't add it
        if (stubs.length > 0 && stubs[0].tags.findIndex((x) => x.id === tag.id) >= 0) {
            return;
        }

        const updatedStubs = [...stubs];
        updatedStubs.forEach((stub) => {
            stub.tags = [...stub.tags, tag];
        });

        onUpdateStubs(updatedStubs);
    };

    const handleDeleteTag = (tag: ITag) => {
        const updatedStubs = [...stubs];
        updatedStubs.forEach((stub) => {
            stub.tags = stub.tags.filter((x) => x.id !== tag.id);
        });

        onUpdateStubs(updatedStubs);
    };

    const tags = stubs.length > 0 ? stubs[0].tags : [];

    const fixedListHeight = windowHeight - 465 < 500 ? 500 : windowHeight - 465;

    return (
        <>
            <Paper elevation={0}>
                <Box sx={{ paddingTop: '0.5rem' }}>
                    <Typography gutterBottom sx={{ fontWeight: 'bold' }} variant="h6">
                        Importing {stubs.length} article{stubs.length > 1 ? 's' : ''} from pubmed
                    </Typography>
                    <Typography sx={{ marginBottom: '0.5rem' }} variant="body1">
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
                    </Box>
                </Box>
                <Divider sx={{ marginTop: '0.5rem' }} />
            </Paper>
            <Box sx={{ margin: '1rem 0' }}>
                <Typography sx={{ color: 'gray', fontStyle: 'italic' }}>
                    Studies marked as "Duplicate" have a red border
                </Typography>
                <FixedSizeList
                    height={fixedListHeight}
                    itemCount={stubs.length}
                    width="100%"
                    itemSize={210}
                    itemKey={(index, data) => data.stubs[index]?.id}
                    layout="vertical"
                    itemData={{
                        stubs: stubs,
                    }}
                    overscanCount={3}
                >
                    {CurationImportTagFixedSizeListRow}
                </FixedSizeList>
            </Box>
            <NavigationButtons
                nextButtonStyle="contained"
                nextButtonDisabled={stubs.length === 0}
                onButtonClick={onNavigate}
            />
        </>
    );
};

export default CurationImportTag;

import { Box, Typography } from '@mui/material';
import NavigationButtons, {
    ENavigationButton,
} from 'components/Buttons/NavigationButtons/NavigationButtons';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import TagSelectorPopup from 'components/CurationComponents/SelectorPopups/TagSelectorPopup/TagSelectorPopup';
import { ITag } from 'hooks/projects/useGetProjects';
import {
    useCreateNewCurationInfoTag,
    useProjectCurationInfoTags,
} from 'pages/Projects/ProjectPage/ProjectStore';
const CurationImportTag: React.FC<{
    onNavigate: (button: ENavigationButton) => void;
    onUpdateStubs: (stubs: ICurationStubStudy[]) => void;
    stubs: ICurationStubStudy[];
}> = (props) => {
    const { onUpdateStubs, onNavigate, stubs } = props;
    const createNewInfoTag = useCreateNewCurationInfoTag();
    const infoTags = useProjectCurationInfoTags();

    const importName = stubs[0]?.tags[0]?.label;

    const handleAddTag = (tag: ITag) => {
        const updatedStubs = [...stubs];
        updatedStubs.forEach((_, index) => {
            updatedStubs[index] = {
                ...updatedStubs[index],
                tags: [tag],
            };
        });

        onUpdateStubs(updatedStubs);
    };

    const handleClearInput = () => {
        const updatedStubs = [...stubs];
        updatedStubs.forEach((_, index) => {
            updatedStubs[index] = {
                ...updatedStubs[index],
                tags: [],
            };
        });

        onUpdateStubs(updatedStubs);
    };

    const handleNavigate = (nav: ENavigationButton) => {
        const tagToCreate = stubs[0]?.tags[0];

        if (tagToCreate && !infoTags.some((x) => x.id === tagToCreate.id)) {
            createNewInfoTag(tagToCreate);
        }

        onNavigate(nav);
    };

    return (
        <Box sx={{ paddingTop: '0.5rem' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
                <Box sx={{ width: '600px' }}>
                    <Typography
                        gutterBottom
                        sx={{ fontWeight: 'bold', marginRight: '4px' }}
                        variant="h6"
                    >
                        Give your import a name:{' '}
                        <span style={{ fontWeight: 'normal' }}>{importName || ''}</span>
                    </Typography>

                    <TagSelectorPopup
                        size="medium"
                        label="import name"
                        placeholder="start typing or select from previous imports"
                        sx={{ margin: '1rem 0' }}
                        onAddTag={handleAddTag}
                        onCreateTag={handleAddTag}
                        addOptionText="Set name as"
                        autoCreateTagOnClick={false}
                        onClearInput={handleClearInput}
                    />
                </Box>
            </Box>
            <NavigationButtons nextButtonDisabled={!importName} onButtonClick={handleNavigate} />
        </Box>
    );
};

export default CurationImportTag;

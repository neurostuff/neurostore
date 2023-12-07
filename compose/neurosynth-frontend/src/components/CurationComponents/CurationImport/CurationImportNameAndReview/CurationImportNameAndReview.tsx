import { Box, Button, Typography } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import TagSelectorPopup, {
    AutoSelectOption,
} from 'components/CurationComponents/SelectorPopups/TagSelectorPopup/TagSelectorPopup';
import { ITag } from 'hooks/projects/useGetProjects';
import {
    useCreateNewCurationInfoTag,
    useProjectCurationInfoTags,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import CurationImportBaseStyles from '../CurationImportBase.styles';
import CurationImportReview from './CurationImportReview';
const CurationImportNameAndReview: React.FC<{
    onNavigate: (button: ENavigationButton) => void;
    onUpdateStubs: (stubs: ICurationStubStudy[]) => void;
    stubs: ICurationStubStudy[];
    unimportedStubs: string[];
}> = (props) => {
    const { onUpdateStubs, onNavigate, stubs, unimportedStubs } = props;
    const infoTags = useProjectCurationInfoTags();
    const createNewInfoTag = useCreateNewCurationInfoTag();
    const [tag, setTag] = useState<AutoSelectOption | undefined>();

    const intialized = useRef<boolean>(false);

    useEffect(() => {
        const searchTerm = stubs[0]?.searchTerm;
        if (tag || !searchTerm || intialized.current) return;
        const existingTag = infoTags.find((infoTag) => infoTag.label === searchTerm);
        if (existingTag) {
            setTag(existingTag);
        } else {
            setTag({
                id: uuidv4(),
                label: searchTerm,
                addOptionActualLabel: null,
            });
        }
        intialized.current = true;
    }, [infoTags, stubs, tag]);

    const handleAddTag = (tag: AutoSelectOption) => {
        setTag(tag);
    };

    const handleClearInput = () => {
        setTag(undefined);
    };

    const handleClickNext = () => {
        if (!tag) return;
        let newTag: ITag;

        const existingTag = infoTags.find((infoTag) => infoTag.id === tag.id);
        if (existingTag) {
            newTag = existingTag;
        } else {
            newTag = {
                id: uuidv4(),
                label: tag.label,
                isExclusionTag: false,
                isAssignable: true,
            };
            createNewInfoTag(newTag);
        }

        const updatedStubs = [...stubs];
        updatedStubs.forEach((_, index) => {
            updatedStubs[index] = {
                ...updatedStubs[index],
                tags: [newTag],
            };
        });
        onUpdateStubs(updatedStubs);
        return;
    };

    return (
        <Box sx={{ paddingTop: '0.5rem' }}>
            <Box sx={{ margin: '1rem 0' }}>
                <Typography
                    gutterBottom
                    sx={{ fontWeight: 'bold', marginRight: '4px' }}
                    variant="h6"
                >
                    Give your import a name (or add to previous import)
                </Typography>

                <TagSelectorPopup
                    size="medium"
                    label="enter import name or click to select a previous import"
                    placeholder="start typing or select from previous imports"
                    sx={{ margin: '1rem 0' }}
                    onAddTag={handleAddTag}
                    onCreateTag={handleAddTag}
                    addOptionText="Set name as"
                    onClearInput={handleClearInput}
                    value={tag}
                />

                <CurationImportReview stubs={stubs} unimportedStubs={unimportedStubs} />
            </Box>
            <Box sx={CurationImportBaseStyles.fixedContainer}>
                <Box sx={CurationImportBaseStyles.fixedButtonsContainer}>
                    <Button variant="outlined" onClick={() => onNavigate(ENavigationButton.PREV)}>
                        back
                    </Button>
                    <Button
                        variant="contained"
                        sx={CurationImportBaseStyles.nextButton}
                        disableElevation
                        disabled={!tag}
                        onClick={handleClickNext}
                    >
                        next
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

export default CurationImportNameAndReview;

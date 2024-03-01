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
import { SearchBy, SearchByMapping } from 'pages/Studies/StudiesPage/models';
import { EImportMode } from '../CurationDoImport/CurationDoImport';

const createTagName = (searchTerm: string | undefined, importMode: EImportMode) => {
    if (importMode !== EImportMode.NEUROSTORE_IMPORT) {
        return `${importMode}-${new Date().toISOString()}`;
    }

    // for pubmed and standard format imports or if the user just does not enter a search term, then we give back a tag with just the date searched
    if (!searchTerm) return '';
    const parsedSearch = new URLSearchParams(searchTerm);
    const search = parsedSearch.get(SearchByMapping[SearchBy.ALL]);
    const searchString = search ? `${search} ` : '';
    const title = parsedSearch.get(SearchByMapping[SearchBy.TITLE]);
    const titleSearchString = title ? `title=${title}` : '';
    const description = parsedSearch.get(SearchByMapping[SearchBy.DESCRIPTION]);
    const descriptionSearchString = description ? `description=${description} ` : '';
    const author = parsedSearch.get(SearchByMapping[SearchBy.AUTHORS]);
    const authorSearchString = author ? `author=${author}` : '';
    const journal = parsedSearch.get(SearchByMapping[SearchBy.JOURNAL]);
    const journalSearchString = journal ? `journal=${journal}` : '';
    const dataType = parsedSearch.get('dataType');
    const dataTypeSearchString = dataType ? `datatype=${dataType}` : '';

    const allParametersString = [
        titleSearchString,
        descriptionSearchString,
        authorSearchString,
        journalSearchString,
        dataTypeSearchString,
    ]
        .filter((x) => x !== '')
        .reduce((acc, curr, index, arr) => {
            if (arr.length === 0) {
                return '';
            } else if (arr.length === 1) {
                return `(${acc}${curr})`;
            } else if (index === 0) {
                return `(${acc}${curr}`;
            } else if (index >= arr.length - 1) {
                return `${acc}, ${curr})`;
            } else {
                return `${acc}, ${curr}`;
            }
        }, '');

    return `${searchString}${allParametersString}`;
};

const CurationImportNameAndReview: React.FC<{
    importMode: EImportMode;
    onNavigate: (button: ENavigationButton) => void;
    onUpdateStubs: (stubs: ICurationStubStudy[]) => void;
    stubs: ICurationStubStudy[];
    unimportedStubs: string[];
}> = (props) => {
    const { onUpdateStubs, onNavigate, stubs, unimportedStubs, importMode } = props;
    const infoTags = useProjectCurationInfoTags();
    const createNewInfoTag = useCreateNewCurationInfoTag();
    const [tag, setTag] = useState<AutoSelectOption | undefined>();

    const intialized = useRef<boolean>(false);

    useEffect(() => {
        const tagName = createTagName(stubs[0]?.searchTerm, importMode);
        if (!tagName || tag || intialized.current) return;
        const existingTag = infoTags.find((infoTag) => infoTag.label === tagName);
        if (existingTag) {
            setTag(existingTag);
        } else {
            setTag({
                id: uuidv4(),
                label: tagName,
                addOptionActualLabel: null,
            });
        }
        intialized.current = true;
    }, [importMode, infoTags, stubs, tag]);

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
                    sx={{ fontWeight: 'bold', marginRight: '4px', display: 'inline' }}
                    variant="h6"
                >
                    Give your import a name (or add to previous import):{' '}
                </Typography>
                <Typography sx={{ display: 'inline' }} variant="h6">
                    {tag?.label || ''}
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

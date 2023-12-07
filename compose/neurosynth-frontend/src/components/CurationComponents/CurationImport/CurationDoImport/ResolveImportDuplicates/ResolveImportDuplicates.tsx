import {
    Box,
    Typography,
    Button,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    ToggleButtonGroup,
    ToggleButton,
} from '@mui/material';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import { useEffect, useState } from 'react';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import { defaultExclusionTags } from 'pages/Projects/ProjectPage/ProjectStore.helpers';
import { createDuplicateMap } from '../../helpers/utils';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ReadOnlyStubSummary from '../../ReadOnlyStubSummary';
import DuplicateCaseStyles from '../../CurationImportResolveDuplicates/DuplicateCase/DuplicateCase.styles';
import CurationImportBaseStyles from '../../CurationImportBase.styles';

type IResolveImportDuplicatesCurationStubStudy = ICurationStubStudy & {
    resolution?: 'duplicate' | 'not-duplicate';
};

const ResolveImportDuplicates: React.FC<{
    stubs: ICurationStubStudy[];
    onNavigate: (button: ENavigationButton) => void;
    onImportStubs: (stubs: ICurationStubStudy[], unimportedStubs?: string[]) => void;
}> = (props) => {
    const [duplicates, setDuplicates] = useState<IResolveImportDuplicatesCurationStubStudy[][]>([]);
    const [isValid, setIsValid] = useState(false);
    const [currStub, setCurrStub] = useState(0);

    useEffect(() => {
        setIsValid(duplicates.flat().every((x) => x.resolution));
    }, [duplicates]);

    useEffect(() => {
        if (props.stubs.length === 0) return;
        const { duplicatesList } = createDuplicateMap(props.stubs);
        const duplicates = duplicatesList.filter((x) => x.length > 1);
        setDuplicates(duplicates);
    }, [props.stubs]);

    // resolution is an optional property in the IResolveImportDuplicatesCurationStubStudy object that is not initially set,
    // but is added during this function call when the user makes a selection
    const handleResolveDuplicate = (
        duplicateListIndex: number,
        duplicateStubIndex: number,
        userResolution?: 'duplicate' | 'not-duplicate'
    ) => {
        if (!userResolution) return;

        setDuplicates((prev) => {
            const update = [...prev];

            const duplicateList = [...update[duplicateListIndex]];

            if (userResolution === 'duplicate') {
                duplicateList[duplicateStubIndex] = {
                    ...duplicateList[duplicateStubIndex],
                    resolution: 'duplicate',
                    exclusionTag: defaultExclusionTags.duplicate,
                };
                update[duplicateListIndex] = duplicateList;
            } else {
                // automatically set all other studies as "duplicate" if the user selects "keep"
                duplicateList.forEach((duplicate, index, arr) => {
                    if (index === duplicateStubIndex) {
                        arr[index] = {
                            ...arr[index],
                            resolution: 'not-duplicate',
                            exclusionTag: null,
                        };
                    } else {
                        arr[index] = {
                            ...arr[index],
                            resolution: arr[index].resolution ? arr[index].resolution : 'duplicate',
                            exclusionTag: arr[index].resolution
                                ? arr[index].exclusionTag
                                : defaultExclusionTags.duplicate,
                        };
                    }
                });
                update[duplicateListIndex] = duplicateList;
            }

            if (update[duplicateListIndex].every((x) => x.resolution)) {
                setCurrStub((prev) => prev + 1);
            }
            return update;
        });
    };

    const handleClickNext = (event: React.MouseEvent) => {
        const updatedStubs = [...props.stubs];

        duplicates.flat().forEach((stub) => {
            const stubToUpdateIndex = updatedStubs.findIndex((x) => x.id === stub.id);
            if (stubToUpdateIndex >= 0)
                updatedStubs[stubToUpdateIndex] = {
                    ...updatedStubs[stubToUpdateIndex],
                    exclusionTag: stub.exclusionTag,
                };
        });

        props.onImportStubs(updatedStubs);
        props.onNavigate(ENavigationButton.NEXT);
    };

    return (
        <Box sx={{ margin: '1rem 0 6rem 0' }}>
            <Typography variant="h6" sx={{ marginBottom: '1rem', color: 'error.dark' }}>
                Duplicates were found in your import file
            </Typography>
            <Typography sx={{ color: 'gray' }}>
                Some studies within the list you are importing have been flagged as duplicates.
            </Typography>
            <Typography gutterBottom sx={{ color: 'gray' }}>
                Resolve below by clicking on the <b>"KEEP THIS STUDY"</b> button for the study that
                you want. Other studies will be marked as duplicates.
            </Typography>

            <Box>
                {duplicates.map((duplicateList, duplicateIndex) => {
                    const isResolved = duplicateList.every((x) => x.resolution);

                    return (
                        <Accordion
                            elevation={0}
                            key={duplicateIndex}
                            expanded={duplicateIndex === currStub}
                            onChange={() => setCurrStub(duplicateIndex)}
                        >
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                                sx={{
                                    ':hover': {
                                        backgroundColor: '#f2f2f2',
                                    },
                                }}
                            >
                                {isResolved ? (
                                    <CheckCircleOutlineIcon color="success" />
                                ) : (
                                    <ErrorOutlineIcon color="warning" />
                                )}
                                <Typography
                                    sx={{
                                        color: isResolved ? 'success.dark' : 'warning.dark',
                                        marginLeft: '1rem',
                                    }}
                                >
                                    {isResolved ? 'Resolved' : 'Unresolved'}
                                </Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                {duplicateList.map((stub, duplicateStubIndex) => (
                                    <Box
                                        key={stub.id}
                                        sx={[
                                            { display: 'flex', marginBottom: '10px' },
                                            DuplicateCaseStyles.resolutionContainer,
                                        ]}
                                    >
                                        <Box
                                            sx={{
                                                width: 'calc(100% - 380px)',
                                                marginRight: '30px',
                                            }}
                                        >
                                            <Box sx={{ width: '100%' }}>
                                                <ReadOnlyStubSummary {...stub} />
                                            </Box>
                                        </Box>
                                        <Box sx={{ width: '350px' }}>
                                            <ToggleButtonGroup
                                                exclusive
                                                value={stub.resolution}
                                                onChange={(
                                                    _,
                                                    resolution: 'duplicate' | 'not-duplicate' | null
                                                ) =>
                                                    handleResolveDuplicate(
                                                        duplicateIndex,
                                                        duplicateStubIndex,
                                                        resolution ? resolution : undefined
                                                    )
                                                }
                                            >
                                                <ToggleButton color="primary" value="not-duplicate">
                                                    Keep this study
                                                </ToggleButton>
                                                <ToggleButton color="error" value="duplicate">
                                                    This is a duplicate
                                                </ToggleButton>
                                            </ToggleButtonGroup>
                                        </Box>
                                    </Box>
                                ))}
                            </AccordionDetails>
                        </Accordion>
                    );
                })}
            </Box>

            <Box sx={CurationImportBaseStyles.fixedContainer}>
                <Box sx={CurationImportBaseStyles.fixedButtonsContainer}>
                    <Button
                        variant="outlined"
                        onClick={() => props.onNavigate(ENavigationButton.PREV)}
                    >
                        back
                    </Button>
                    <Button
                        variant="contained"
                        sx={CurationImportBaseStyles.nextButton}
                        disableElevation
                        disabled={!isValid}
                        onClick={handleClickNext}
                    >
                        next
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

export default ResolveImportDuplicates;

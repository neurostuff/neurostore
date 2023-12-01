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

type IResolveImportDuplicatesCurationStubStudy = ICurationStubStudy & {
    resolution?: 'duplicate' | 'not-duplicate';
};

const ResolveImportDuplicates: React.FC<{
    stubs: ICurationStubStudy[];
    onResolveStubs: (stubs: ICurationStubStudy[]) => void;
    onNavigate: (button: ENavigationButton) => void;
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

    const handleResolveDuplicate = (
        duplicateListIndex: number,
        duplicateStubIndex: number,
        resolution?: 'duplicate' | 'not-duplicate'
    ) => {
        if (!resolution) return;

        setDuplicates((prev) => {
            const update = [...prev];

            const duplicateList = [...update[duplicateListIndex]];

            if (resolution === 'duplicate') {
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

        props.onResolveStubs(updatedStubs);
    };

    return (
        <Box sx={{ marginTop: '1rem' }}>
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
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
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
                                    <Box key={stub.id} sx={{ display: 'flex' }}>
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

            <Box sx={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between' }}>
                <Button variant="outlined" onClick={() => props.onNavigate(ENavigationButton.PREV)}>
                    back
                </Button>
                <Button variant="contained" disabled={!isValid} onClick={handleClickNext}>
                    next
                </Button>
            </Box>
        </Box>
    );
};

export default ResolveImportDuplicates;

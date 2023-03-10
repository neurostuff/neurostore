import {
    Box,
    Typography,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Button,
    ToggleButtonGroup,
    ToggleButton,
} from '@mui/material';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import { useEffect, useState } from 'react';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { ENeurosynthTagIds } from 'components/ProjectStepComponents/CurationStep/CurationStep';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import PubMedImportStudySummary from 'components/Dialogs/PubMedImportDialog/PubMedImportStudySummary';

type IResolveImportCurationStubStudy = ICurationStubStudy & {
    columnIndex?: number;
    studyIndex?: number;
    resolution?: 'duplicate' | 'not-duplicate';
};

// a study is defined as a duplicate if it has either a matching PMID, DOI, or title.
// We must account for the case where a study has a missing PMID, DOI, or title as well.
export const extractDuplicates = (
    stubs: IResolveImportCurationStubStudy[]
): IResolveImportCurationStubStudy[][] => {
    if (stubs.length <= 0) return [];
    const map = new Map<string, ICurationStubStudy[]>();
    const duplicatesList: ICurationStubStudy[][] = [];

    stubs.forEach((stub) => {
        const formattedTitle = stub.title.toLocaleLowerCase().trim();
        if (stub.doi && map.has(stub.doi)) {
            const duplicatedStubs = map.get(stub.doi);
            duplicatedStubs!.push(stub);
        } else if (stub.pmid && map.has(stub.pmid)) {
            const duplicatedStubs = map.get(stub.pmid);
            duplicatedStubs!.push(stub);
        } else if (stub.title && map.has(formattedTitle)) {
            // in the future, this title search can be replaced with a fuzzier search via a string comparison algorithm
            const duplicatedStubs = map.get(formattedTitle);
            duplicatedStubs!.push(stub);
        } else {
            const newDuplicatedStubsList: ICurationStubStudy[] = [];
            newDuplicatedStubsList.push(stub);
            duplicatesList.push(newDuplicatedStubsList);
            if (stub.doi) map.set(stub.doi, newDuplicatedStubsList);
            if (stub.pmid) map.set(stub.pmid, newDuplicatedStubsList);
            if (formattedTitle) map.set(formattedTitle, newDuplicatedStubsList);
        }
    });

    return duplicatesList.filter((x) => x.length > 1);
};

const ResolveImportDuplicates: React.FC<{
    stubs: ICurationStubStudy[];
    onResolveStubs: (stubs: ICurationStubStudy[]) => void;
    onNavigate: (button: ENavigationButton) => void;
}> = (props) => {
    const [duplicates, setDuplicates] = useState<IResolveImportCurationStubStudy[][]>([]);
    const [isValid, setIsValid] = useState(false);
    const [currStub, setCurrStub] = useState(0);

    useEffect(() => {
        setIsValid(duplicates.flat().every((x) => x.resolution));
    }, [duplicates]);

    useEffect(() => {
        if (props.stubs.length === 0) return;
        const extractedDuplicates = extractDuplicates(props.stubs);
        setDuplicates(extractedDuplicates);
    }, [props.stubs]);

    const handleResolveDuplicate = (
        duplicateListIndex: number,
        studyIndex: number,
        resolution?: 'duplicate' | 'not-duplicate'
    ) => {
        if (!resolution) return;

        setDuplicates((prev) => {
            const update = [...prev];

            const duplicateList = [...update[duplicateListIndex]];
            duplicateList[studyIndex] = {
                ...duplicateList[studyIndex],
                resolution: resolution,
                exclusionTag:
                    resolution === 'duplicate'
                        ? {
                              id: ENeurosynthTagIds.DUPLICATE_EXCLUSION_ID,
                              label: 'Duplicate',
                              isAssignable: true,
                              isExclusionTag: true,
                          }
                        : null,
            };
            update[duplicateListIndex] = duplicateList;

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
                {duplicates.length} {duplicates.length > 1 ? 'studies have ' : 'study has '}{' '}
                potential duplicates in your import
            </Typography>
            <Typography sx={{ color: 'gray' }}>
                Some studies that you are importing have been flagged as duplicates.
            </Typography>
            <Typography gutterBottom sx={{ color: 'gray' }}>
                Resolve below by marking the study of interest as "Not a duplicate", and marking the
                other study/studies as "Duplicate".
            </Typography>

            <Box>
                {duplicates.map((duplicate, duplicateIndex) => {
                    const isResolved = duplicate.every((x) => x.resolution);

                    return (
                        <Accordion
                            elevation={0}
                            key={duplicateIndex}
                            expanded={currStub === duplicateIndex}
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
                                {duplicate.map((stub, stubIndex) => (
                                    <Box key={stub.id} sx={{ display: 'flex' }}>
                                        <Box
                                            sx={{
                                                width: 'calc(100% - 280px)',
                                                marginRight: '30px',
                                            }}
                                        >
                                            <Box sx={{ width: '100%' }}>
                                                <PubMedImportStudySummary {...stub} />
                                            </Box>
                                        </Box>
                                        <Box sx={{ width: '250px' }}>
                                            <ToggleButtonGroup
                                                exclusive
                                                value={stub.resolution}
                                                onChange={(
                                                    _,
                                                    newVal: 'duplicate' | 'not-duplicate' | null
                                                ) =>
                                                    handleResolveDuplicate(
                                                        duplicateIndex,
                                                        stubIndex,
                                                        newVal ? newVal : undefined
                                                    )
                                                }
                                            >
                                                <ToggleButton color="primary" value="not-duplicate">
                                                    Not a duplicate
                                                </ToggleButton>
                                                <ToggleButton color="error" value="duplicate">
                                                    Duplicate
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

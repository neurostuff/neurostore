import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Chip,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import NavigationButtons, {
    ENavigationButton,
} from 'components/Buttons/NavigationButtons/NavigationButtons';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import {
    useProjectCurationColumns,
    useProjectId,
    useUpdateCurationColumns,
} from 'pages/Projects/ProjectPage/ProjectStore';
import { useEffect, useState } from 'react';
import { createDuplicateMap } from '../helpers/utils';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { defaultExclusionTags } from 'pages/Projects/ProjectPage/ProjectStore.helpers';
import { ENeurosynthTagIds } from 'pages/Projects/ProjectPage/ProjectStore.helpers';
import { useHistory } from 'react-router-dom';
import ReadOnlyStubSummary from '../ReadOnlyStubSummary';
import { ICurationColumn } from 'components/CurationComponents/CurationColumn/CurationColumn';

type IResolveProjectDuplicatesCurationStubStudy = ICurationStubStudy & {
    columnIndex?: number;
    studyIndex?: number;
    resolution?: 'duplicate' | 'not-duplicate' | 'resolved';
    colName?: string;
};

const flattenColumns = (cols: ICurationColumn[]): IResolveProjectDuplicatesCurationStubStudy[] => {
    const allStubsInProject: IResolveProjectDuplicatesCurationStubStudy[] = (cols || []).reduce(
        (acc, curr, currIndex) => {
            const convertedStudies = curr.stubStudies.map((study, studyIndex) => {
                const resolutionStr: 'duplicate' | 'not-duplicate' | 'resolved' | undefined =
                    study.exclusionTag
                        ? study.exclusionTag.id === ENeurosynthTagIds.DUPLICATE_EXCLUSION_ID
                            ? 'duplicate'
                            : 'resolved'
                        : undefined;

                return {
                    ...study,
                    columnIndex: currIndex,
                    studyIndex: studyIndex,
                    colName: curr.name,
                    resolution: resolutionStr,
                };
            });

            acc.push(...convertedStudies);

            return acc;
        },
        [] as IResolveProjectDuplicatesCurationStubStudy[] // we need to typecast as typescript infers this type as never[]
    );

    return allStubsInProject;
};

const CurationImportResolveDuplicates: React.FC<{
    stubs: ICurationStubStudy[];
    onNavigate: (button: ENavigationButton) => void;
}> = (props) => {
    const updateCurationColumns = useUpdateCurationColumns();
    const history = useHistory();
    const projectId = useProjectId();
    const [duplicates, setDuplicates] = useState<
        {
            importedStub: ICurationStubStudy & {
                index: number;
                resolution?: 'duplicate' | 'not-duplicate';
            };
            projectDuplicates: IResolveProjectDuplicatesCurationStubStudy[];
        }[]
    >([]);
    const [duplicateResolutionComplete, setDuplicateResolutionComplete] = useState(false);
    const [currStub, setCurrStub] = useState(0);

    const columns = useProjectCurationColumns();

    useEffect(() => {
        const allStubsInProject = flattenColumns(columns);
        const { duplicateMapping } = createDuplicateMap(allStubsInProject);

        setDuplicates((_) => {
            const update: {
                importedStub: ICurationStubStudy & { index: number };
                projectDuplicates: IResolveProjectDuplicatesCurationStubStudy[];
            }[] = [];

            props.stubs.forEach((importedStub, stubIndex) => {
                if (importedStub.exclusionTag !== null) return;

                let key = undefined;
                const formattedTitle = importedStub.title.toLocaleLowerCase().trim();
                if (importedStub.doi && duplicateMapping.has(importedStub.doi)) {
                    key = importedStub.doi;
                } else if (importedStub.pmid && duplicateMapping.has(importedStub.pmid)) {
                    key = importedStub.pmid;
                } else if (importedStub.title && duplicateMapping.has(formattedTitle)) {
                    // in the future, this title search can be replaced with a fuzzier search via a string comparison algorithm
                    key = formattedTitle;
                }
                if (key) {
                    const duplicatedStubs = duplicateMapping.get(
                        key
                    ) as IResolveProjectDuplicatesCurationStubStudy[];
                    update.push({
                        importedStub: {
                            ...importedStub,
                            index: stubIndex,
                        },
                        projectDuplicates: duplicatedStubs,
                    });
                }
            });

            return update;
        });
    }, [columns, props.stubs]);

    const handleResolve = (
        isImportedStub: boolean,
        duplicateCaseIndex: number,
        duplicateStubIndex: number,
        resolution?: 'duplicate' | 'not-duplicate' | undefined
    ) => {
        if (!resolution) return;

        setDuplicates((prev) => {
            const update = [...prev];
            if (isImportedStub) {
                update[duplicateCaseIndex] = {
                    ...update[duplicateCaseIndex],
                    importedStub: {
                        ...update[duplicateCaseIndex].importedStub,
                        resolution: resolution,
                        exclusionTag:
                            resolution === 'duplicate' ? defaultExclusionTags.duplicate : null,
                    },
                };
            } else {
                const updatedProjectDuplicates = [...update[duplicateCaseIndex].projectDuplicates];
                updatedProjectDuplicates[duplicateStubIndex] = {
                    ...updatedProjectDuplicates[duplicateStubIndex],
                    resolution: resolution,
                    exclusionTag:
                        resolution === 'duplicate' ? defaultExclusionTags.duplicate : null,
                };

                update[duplicateCaseIndex] = {
                    ...update[duplicateCaseIndex],
                    projectDuplicates: updatedProjectDuplicates,
                };
            }

            setCurrStub((prev) => {
                const duplicateCaseIsResolved =
                    update[duplicateCaseIndex].importedStub.resolution &&
                    update[duplicateCaseIndex].projectDuplicates.every((x) => x.resolution);

                return duplicateCaseIsResolved ? prev + 1 : prev;
            });
            setDuplicateResolutionComplete((_) => {
                const allResolved = update.every((duplicateCase) => {
                    const duplicateCaseIsResolved =
                        duplicateCase.importedStub.resolution &&
                        duplicateCase.projectDuplicates.every((x) => x.resolution);
                    return duplicateCaseIsResolved;
                });
                return allResolved;
            });
            return update;
        });
    };

    const handleNavigate = (button: ENavigationButton) => {
        if (button === ENavigationButton.PREV) {
            props.onNavigate(button);
        } else {
            // handle import
            const updatedImport = [...props.stubs];
            const updatedColumns = [...columns];

            duplicates.forEach((duplicateCase) => {
                updatedImport[duplicateCase.importedStub.index].exclusionTag =
                    duplicateCase.importedStub.exclusionTag;

                duplicateCase.projectDuplicates.forEach((stub) => {
                    if (stub.columnIndex !== undefined && stub.studyIndex !== undefined) {
                        const updatedStubStudies = [
                            ...updatedColumns[stub.columnIndex].stubStudies,
                        ];

                        updatedStubStudies[stub.studyIndex] = {
                            ...updatedStubStudies[stub.studyIndex],
                            exclusionTag: stub.exclusionTag,
                        };
                        updatedColumns[stub.columnIndex].stubStudies = updatedStubStudies;
                    }
                });
            });

            updatedColumns[0].stubStudies = [...updatedImport, ...updatedColumns[0].stubStudies];
            updateCurationColumns(updatedColumns);
            history.push(`/projects/${projectId}/curation`);
        }
    };

    if (duplicates.length === 0) {
        return (
            <Box sx={{ margin: '1rem 0' }}>
                <Typography gutterBottom variant="h6">
                    No duplicates detected between the studies in your import and the studies within
                    your project.
                </Typography>
                <Typography variant="caption" sx={{ color: 'warning.dark' }}>
                    Note: Neurosynth Compose primarily does a quick and simple search for any
                    matching PMIDs, DOIs, or titles that may exist in this project already. This is
                    not a comprehensive search and independent analysis should be done to make sure
                    duplicates are correctly identified.
                </Typography>
                <Box sx={{ marginTop: '1rem' }}>
                    <NavigationButtons
                        onButtonClick={handleNavigate}
                        nextButtonStyle="contained"
                        nextButtonText="complete import"
                    />
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ margin: '1rem 0' }}>
            <Typography variant="h6" sx={{ marginBottom: '1rem', color: 'error.dark' }}>
                {duplicates.length} {duplicates.length > 1 ? 'studies have ' : 'study has '}{' '}
                potential duplicates that already exist within the project
            </Typography>
            <Typography sx={{ color: 'gray' }}>
                Some studies that you are importing have potential existing duplicates.
            </Typography>
            <Typography gutterBottom sx={{ color: 'gray' }}>
                Resolve below by marking the study of interest as "Not a duplicate", and marking the
                other study/studies as "Duplicate".
            </Typography>
            {duplicates.map((duplicateCase, duplicateCaseIndex) => {
                const { importedStub, projectDuplicates } = duplicateCase;
                const isResolved =
                    importedStub.resolution && projectDuplicates.every((x) => x.resolution);

                return (
                    <Accordion
                        elevation={0}
                        key={duplicateCaseIndex}
                        expanded={duplicateCaseIndex === currStub}
                        onChange={() => setCurrStub(duplicateCaseIndex)}
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
                            <Typography
                                sx={{ fontWeight: 'bold', marginBottom: '1rem' }}
                                variant="h6"
                            >
                                This is the study you are importing
                            </Typography>
                            <Box sx={{ display: 'flex' }}>
                                <Box
                                    sx={{
                                        width: 'calc(100% - 280px)',
                                        marginRight: '30px',
                                    }}
                                >
                                    <Box sx={{ width: '100%' }}>
                                        <ReadOnlyStubSummary {...importedStub} />
                                    </Box>
                                </Box>
                                <Box sx={{ width: '250px' }}>
                                    <ToggleButtonGroup
                                        exclusive
                                        value={importedStub.resolution}
                                        onChange={(
                                            _,
                                            resolution: 'duplicate' | 'not-duplicate' | null
                                        ) =>
                                            handleResolve(
                                                true,
                                                duplicateCaseIndex,
                                                0, // not used
                                                resolution ? resolution : undefined
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

                            <Typography
                                sx={{ fontWeight: 'bold', marginBottom: '1rem' }}
                                variant="h6"
                            >
                                These studies exist within the project
                            </Typography>
                            {projectDuplicates.map((stub, duplicateStubIndex) => (
                                <Box key={stub.id} sx={{ display: 'flex', marginTop: '0.5rem' }}>
                                    <Box
                                        sx={{
                                            width: 'calc(100% - 280px)',
                                            marginRight: '30px',
                                        }}
                                    >
                                        <Box sx={{ width: '100%' }}>
                                            <Chip size="small" color="info" label={stub.colName} />
                                            <ReadOnlyStubSummary {...stub} />
                                        </Box>
                                    </Box>
                                    <Box sx={{ width: '250px' }}>
                                        {stub.resolution === 'resolved' ? (
                                            <Typography variant="h6" sx={{ color: 'error.dark' }}>
                                                Excluded: {stub.exclusionTag?.label}
                                            </Typography>
                                        ) : (
                                            <ToggleButtonGroup
                                                exclusive
                                                value={stub.resolution}
                                                onChange={(
                                                    _,
                                                    resolution: 'duplicate' | 'not-duplicate' | null
                                                ) =>
                                                    handleResolve(
                                                        false,
                                                        duplicateCaseIndex,
                                                        duplicateStubIndex,
                                                        resolution ? resolution : undefined
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
                                        )}
                                    </Box>
                                </Box>
                            ))}
                        </AccordionDetails>
                    </Accordion>
                );
            })}
            <Box sx={{ marginTop: '1rem' }}>
                <NavigationButtons
                    nextButtonStyle="contained"
                    nextButtonDisabled={!duplicateResolutionComplete}
                    nextButtonText="complete import"
                    onButtonClick={handleNavigate}
                />
            </Box>
        </Box>
    );
};

export default CurationImportResolveDuplicates;

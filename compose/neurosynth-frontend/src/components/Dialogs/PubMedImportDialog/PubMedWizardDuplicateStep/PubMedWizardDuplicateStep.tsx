import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Button,
    Divider,
    Typography,
} from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudy';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import PubMedImportStudySummary from 'components/Dialogs/PubMedImportDialog/PubMedImportStudySummary';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import useUpdateProject from 'hooks/requests/useUpdateProject';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import { useSnackbar } from 'notistack';
import { ENeurosynthTagIds } from 'components/ProjectStepComponents/CurationStep/CurationStep';
import { ITag } from 'hooks/requests/useGetProjects';

interface IPubMedWizardDuplicateStep {
    stubs: ICurationStubStudy[];
    onCompleteImport: () => void;
    onChangeStep: (arg: ENavigationButton) => void;
}

interface IDuplicateStub {
    existingStub: ICurationStubStudy & { colIndex: number; studyIndex: number };
    newStub: ICurationStubStudy;
    resolution: 'existingStub' | 'newStub' | 'markNeither' | undefined;
}

const PubMedwizardDuplicateStep: React.FC<IPubMedWizardDuplicateStep> = (props) => {
    const { projectId }: { projectId: string | undefined } = useParams();
    const { enqueueSnackbar } = useSnackbar();
    const {
        data,
        isLoading: getProjectIsLoading,
        isError: getProjectIsError,
    } = useGetProjectById(projectId);
    const {
        mutate,
        isLoading: updateProjectIsLoading,
        isError: updateProjectIsError,
    } = useUpdateProject();

    const [duplicates, setDuplicates] = useState<IDuplicateStub[]>([]);
    const [expanded, setExpanded] = useState(0);

    useEffect(() => {
        const allExistingStubs = (data?.provenance?.curationMetadata?.columns || []).reduce(
            (acc, curr, currIndex) => [
                ...acc,
                ...curr.stubStudies.map((study, studyIndex) => ({
                    ...study,
                    colIndex: currIndex,
                    studyIndex: studyIndex,
                })),
            ],
            [] as (ICurationStubStudy & { colIndex: number; studyIndex: number })[] // we need to typecast as typescript infers this type as never[]
        );

        if (props.stubs.length > 0 && allExistingStubs.length > 0) {
            const duplicates: IDuplicateStub[] = [];

            const pmidSet = new Set(allExistingStubs.map((x) => x.pmid));
            const doiSet = new Set(allExistingStubs.map((x) => x.doi));

            props.stubs.forEach((stub) => {
                if (pmidSet.has(stub.pmid) || doiSet.has(stub.doi)) {
                    const duplicatedPmid = pmidSet.has(stub.pmid);
                    const existingStub = allExistingStubs.find((x) =>
                        duplicatedPmid ? x.pmid === stub.pmid : x.doi === stub.doi
                    );
                    if (existingStub) {
                        duplicates.push({
                            existingStub: existingStub,
                            newStub: stub,
                            resolution: undefined,
                        });
                    }
                }
            });

            setDuplicates(duplicates);
        }
    }, [data, props.stubs]);

    // mark the duplicates and save the new stubs into the project
    const handleImport = () => {
        if (
            projectId &&
            data?.provenance?.curationMetadata?.infoTags &&
            data?.provenance?.curationMetadata?.infoTags.length > 0 &&
            data?.provenance?.curationMetadata?.columns &&
            data?.provenance?.curationMetadata?.columns.length > 0 &&
            data?.provenance?.curationMetadata?.columns.every((col) => !!col.stubStudies)
        ) {
            let duplicateTag: ITag | undefined;
            if (data?.provenance?.curationMetadata?.prismaConfig?.isPrisma) {
                duplicateTag =
                    data.provenance.curationMetadata.prismaConfig.identification.exclusionTags.find(
                        (x) => x.id === ENeurosynthTagIds.DUPLICATE_EXCLUSION_ID
                    );
            } else {
                duplicateTag = data.provenance.curationMetadata.exclusionTags.find(
                    (x) => x.id === ENeurosynthTagIds.DUPLICATE_EXCLUSION_ID
                );
            }
            if (!duplicateTag) return;

            const newStubsToAdd = [...props.stubs];
            const updatedProvenanceColumns = [...data.provenance.curationMetadata.columns];

            duplicates.forEach((duplicate) => {
                if (duplicate.resolution === 'existingStub') {
                    updatedProvenanceColumns[duplicate.existingStub.colIndex].stubStudies[
                        duplicate.existingStub.studyIndex
                    ].exclusionTag = duplicateTag as ITag;
                } else if (duplicate.resolution === 'newStub') {
                    const stub = newStubsToAdd.find((stub) => stub.id === duplicate.newStub.id);
                    if (!stub) return;
                    stub.exclusionTag = duplicateTag as ITag;
                }
            });

            updatedProvenanceColumns[0].stubStudies = [
                ...newStubsToAdd,
                ...updatedProvenanceColumns[0].stubStudies,
            ];

            mutate(
                {
                    projectId: projectId,
                    project: {
                        provenance: {
                            ...data.provenance,
                            curationMetadata: {
                                ...data.provenance.curationMetadata,
                                columns: updatedProvenanceColumns,
                            },
                        },
                    },
                },
                {
                    onSuccess: () => {
                        enqueueSnackbar('imported studies successfully', { variant: 'success' });
                        props.onCompleteImport();
                    },
                }
            );
        }
    };

    const handleMarkDuplicate = (
        duplicateIndex: number,
        resolution: 'existingStub' | 'newStub' | 'markNeither'
    ) => {
        setDuplicates((prev) => {
            if (duplicateIndex >= duplicates.length) return prev;
            const update = [...prev];
            update[duplicateIndex].resolution = resolution;
            return update;
        });
        setExpanded((prev) => prev + 1);
    };

    if (duplicates.length === 0) {
        return (
            <Box>
                <Typography gutterBottom variant="h6">
                    No duplicates found
                </Typography>
                <Typography variant="caption" sx={{ color: 'warning.dark' }}>
                    Note: Neurosynth Compose primarily does a quick and simple search for any
                    matching PMID or DOIs that may exist in this project already. This is not a
                    comprehensive search and independent analysis should be done to make sure
                    duplicates are correctly identified.
                </Typography>
                <Box sx={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between' }}>
                    <Button
                        variant="outlined"
                        onClick={() => props.onChangeStep(ENavigationButton.PREV)}
                    >
                        back
                    </Button>
                    <LoadingButton
                        sx={{ width: '164px' }}
                        loaderColor="secondary"
                        variant="contained"
                        text="complete import"
                        onClick={handleImport}
                        isLoading={updateProjectIsLoading}
                    />
                </Box>
            </Box>
        );
    }

    const canContinue = duplicates.length === 0 || duplicates.every((x) => !!x.resolution);

    return (
        <Box>
            <Typography sx={{ marginBottom: '1rem' }}>
                {duplicates.length} Duplicate(s) Identified
            </Typography>

            <Box>
                {duplicates.map((duplicate, index) => (
                    <Accordion
                        elevation={0}
                        key={index}
                        expanded={expanded === index}
                        onChange={() => setExpanded(index)}
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            sx={{ color: !duplicate.resolution ? 'warning.dark' : 'success.main' }}
                        >
                            {!duplicate.resolution ? (
                                <ErrorOutlineIcon />
                            ) : (
                                <CheckCircleOutlineIcon />
                            )}

                            <Typography sx={{ marginLeft: '10px' }}>
                                {!duplicate.resolution && 'Unresolved Duplicate'}
                                {duplicate.resolution === 'newStub' &&
                                    'The imported study will be marked as a duplicate'}
                                {duplicate.resolution === 'markNeither' &&
                                    'Neither study will be marked as a duplicate'}
                                {duplicate.resolution === 'existingStub' &&
                                    'The study that already exists in the project will be marked as a duplicate'}
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Box
                                sx={{
                                    marginBottom: '2rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                }}
                            >
                                <Button
                                    onClick={() => handleMarkDuplicate(index, 'newStub')}
                                    size="small"
                                    variant="outlined"
                                    color="secondary"
                                >
                                    mark as duplicate
                                </Button>
                                <Button
                                    onClick={() => handleMarkDuplicate(index, 'markNeither')}
                                    size="small"
                                    variant="outlined"
                                >
                                    not a duplicate
                                </Button>
                                <Button
                                    onClick={() => handleMarkDuplicate(index, 'existingStub')}
                                    size="small"
                                    variant="outlined"
                                    color="secondary"
                                >
                                    mark as duplicate
                                </Button>
                            </Box>
                            <Box sx={{ display: 'flex' }}>
                                <Box sx={{ width: '50%' }}>
                                    <Typography gutterBottom>
                                        <b>This study is being imported</b>
                                    </Typography>
                                    <PubMedImportStudySummary {...duplicates[index].newStub} />
                                </Box>
                                <Box sx={{ margin: '0 10px' }}>
                                    <Divider orientation="vertical" />
                                </Box>
                                <Box sx={{ width: '50%' }}>
                                    <Typography gutterBottom>
                                        <b>This study already exists in the project</b>
                                    </Typography>
                                    <PubMedImportStudySummary {...duplicates[index].existingStub} />
                                </Box>
                            </Box>
                        </AccordionDetails>
                    </Accordion>
                ))}
            </Box>

            <Box sx={{ marginTop: '2rem', display: 'flex', justifyContent: 'space-between' }}>
                <Button
                    variant="outlined"
                    onClick={() => props.onChangeStep(ENavigationButton.PREV)}
                >
                    back
                </Button>
                <LoadingButton
                    sx={{ width: '164px' }}
                    variant="contained"
                    text="complete import"
                    loaderColor="secondary"
                    isLoading={updateProjectIsLoading}
                    disabled={!canContinue}
                    onClick={handleImport}
                />
            </Box>
        </Box>
    );
};

export default PubMedwizardDuplicateStep;

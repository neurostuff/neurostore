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
import { useState, useEffect } from 'react';
import PubMedImportStudySummary from 'components/Dialogs/PubMedImportDialog/PubMedImportStudySummary';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import LoadingButton from 'components/Buttons/LoadingButton/LoadingButton';
import { useSnackbar } from 'notistack';
import { ENeurosynthTagIds } from 'components/ProjectStepComponents/CurationStep/CurationStep';
import { ITag } from 'hooks/requests/useGetProjects';
import {
    useProjectCurationColumns,
    useUpdateCurationColumns,
} from 'pages/Projects/ProjectPage/ProjectStore';

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
    const { enqueueSnackbar } = useSnackbar();

    const [duplicates, setDuplicates] = useState<IDuplicateStub[]>([]);
    const [expanded, setExpanded] = useState(0);

    const columns = useProjectCurationColumns();
    const updateCurationColumns = useUpdateCurationColumns();

    useEffect(() => {
        const allExistingStubs = (columns || []).reduce(
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

        if (props.stubs.length <= 0 || allExistingStubs.length <= 0) return;

        const duplicates: IDuplicateStub[] = [];
        const pmidHashMap = allExistingStubs.reduce((acc, curr) => {
            acc.set(curr.pmid, curr);
            return acc;
        }, new Map<string, ICurationStubStudy & { colIndex: number; studyIndex: number }>());
        const doiHashMap = allExistingStubs.reduce((acc, curr) => {
            acc.set(curr.pmid, curr);
            return acc;
        }, new Map<string, ICurationStubStudy & { colIndex: number; studyIndex: number }>());

        props.stubs.forEach((stub) => {
            if (pmidHashMap.has(stub.pmid) || doiHashMap.has(stub.doi)) {
                const existingStub = pmidHashMap.get(stub.pmid) || doiHashMap.get(stub.doi);
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
    }, [columns, props.stubs]);

    // mark the duplicates and save the new stubs into the project
    const handleImport = () => {
        const duplicateTag: ITag = {
            id: ENeurosynthTagIds.DUPLICATE_EXCLUSION_ID,
            label: 'Duplicate',
            isAssignable: true,
            isExclusionTag: true,
        };

        const newStubsToAdd = [...props.stubs];
        const updatedCurationColumns = [...columns];

        duplicates.forEach((duplicate) => {
            if (duplicate.resolution === 'existingStub') {
                updatedCurationColumns[duplicate.existingStub.colIndex].stubStudies[
                    duplicate.existingStub.studyIndex
                ].exclusionTag = duplicateTag as ITag;
            } else if (duplicate.resolution === 'newStub') {
                const stub = newStubsToAdd.find((stub) => stub.id === duplicate.newStub.id);
                if (!stub) return;
                stub.exclusionTag = duplicateTag as ITag;
            }
        });

        updatedCurationColumns[0].stubStudies = [
            ...newStubsToAdd,
            ...updatedCurationColumns[0].stubStudies,
        ];

        updateCurationColumns(updatedCurationColumns);

        enqueueSnackbar('imported studies successfully', { variant: 'success' });
        props.onCompleteImport();
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
                    disabled={!canContinue}
                    onClick={handleImport}
                />
            </Box>
        </Box>
    );
};

export default PubMedwizardDuplicateStep;

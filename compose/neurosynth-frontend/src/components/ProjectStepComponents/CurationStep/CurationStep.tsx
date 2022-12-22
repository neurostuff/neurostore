import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import CloseIcon from '@mui/icons-material/Close';
import CheckIcon from '@mui/icons-material/Check';
import {
    Box,
    Step,
    StepContent,
    StepLabel,
    StepProps,
    Typography,
    Card,
    CardContent,
    CircularProgress,
    CardActions,
    Button,
} from '@mui/material';
import NavToolbarPopupSubMenu from 'components/Navbar/NavSubMenu/NavToolbarPopupSubMenu';
import { ICurationMetadata, INeurosynthProject } from 'hooks/requests/useGetProjects';
import { useHistory, useParams } from 'react-router-dom';
import ProjectStepComponentsStyles from '../ProjectStepComponents.styles';
import useUpdateProject from 'hooks/requests/useUpdateProject';
import { ICurationColumn } from 'components/CurationComponents/CurationColumn/CurationColumn';
import { useEffect, useState } from 'react';
import CreateCurationBoardDialog from 'components/Dialogs/CreateCurationBoardDialog/CreateCurationBoardDialog';
import { MutateOptions } from 'react-query';
import { AxiosError, AxiosResponse } from 'axios';
import { ProjectReturn } from 'neurosynth-compose-typescript-sdk';
import { useSnackbar } from 'notistack';

enum ECurationBoardTypes {
    PRISMA,
    SIMPLE,
    CUSTOM,
    SKIP,
}

export enum ENeurosynthTagIds {
    UNTAGGED_TAG_ID = 'neurosynth_untagged_tag',
    SPECIAL_TAG_ID = 'neurosynth_special_tag',
    SAVE_FOR_LATER_TAG_ID = 'neurosynth_save_for_later_tag',
    DUPLICATE_EXCLUSION_ID = 'neurosynth_duplicate_exclusion',
    IRRELEVANT_EXCLUSION_ID = 'neurosynth_irrelevant_exclusion',
}

interface ICurationStep {
    curationMetadata: ICurationMetadata | undefined;
}

const CurationStep: React.FC<ICurationStep & StepProps> = (props) => {
    const { projectId }: { projectId: string } = useParams();
    const history = useHistory();
    const { curationMetadata, ...stepProps } = props;
    const { enqueueSnackbar } = useSnackbar();
    const [dialogIsOpen, setDialogIsOpen] = useState(false);
    const [curationSummary, setCurationSummary] = useState({
        total: 0,
        included: 0,
        uncategorized: 0,
        excluded: 0,
    });

    useEffect(() => {
        if (curationMetadata?.columns && curationMetadata.columns.length > 0) {
            setCurationSummary((prev) => {
                const numTotalStudies = curationMetadata.columns.reduce(
                    (acc, curr) => acc + curr.stubStudies.length,
                    0
                );

                // all included studies are in the last column
                const numIncludedStudes =
                    curationMetadata.columns[curationMetadata.columns.length - 1].stubStudies
                        .length;
                const numExcludedStudies = curationMetadata.columns.reduce(
                    (acc, curr) =>
                        acc + curr.stubStudies.filter((study) => !!study.exclusionTag).length,
                    0
                );
                const numUncategorizedStudies =
                    numTotalStudies - numIncludedStudes - numExcludedStudies;

                return {
                    total: numTotalStudies,
                    included: numIncludedStudes,
                    uncategorized: numUncategorizedStudies,
                    excluded: numExcludedStudies,
                };
            });
        }
    }, [curationMetadata]);

    const {
        mutate,
        isLoading: updateProjectIsLoading,
        isError: updateProjectIsError,
    } = useUpdateProject();

    const handleCreateCreationBoard = (curationBoardType: ECurationBoardTypes) => {
        switch (curationBoardType) {
            case ECurationBoardTypes.PRISMA:
                createBoard(['identification', 'screening', 'eligibility', 'included'], {
                    onSuccess: () => {
                        enqueueSnackbar('Curation board created successfully', {
                            variant: 'success',
                        });
                    },
                });
                break;
            case ECurationBoardTypes.SIMPLE:
                createBoard(['included'], {
                    onSuccess: () => {
                        enqueueSnackbar('Curation board created successfully', {
                            variant: 'success',
                        });
                    },
                });
                break;
            case ECurationBoardTypes.CUSTOM:
                setDialogIsOpen(true);
                break;
            case ECurationBoardTypes.SKIP:
                // TODO: implement this
                break;
            default:
                return;
        }
    };

    const createBoard = (
        curationBoardInitColumns: string[],
        options?: MutateOptions<
            AxiosResponse<ProjectReturn>,
            AxiosError<any>,
            {
                projectId: string;
                project: INeurosynthProject;
            }
        >
    ) => {
        const columns: ICurationColumn[] = curationBoardInitColumns.map((col, index) => ({
            id: `${projectId}_${index}`,
            name: col,
            stubStudies: [],
        }));

        mutate(
            {
                projectId,
                project: {
                    provenance: {
                        curationMetadata: {
                            columns: columns,
                            tags: [
                                {
                                    id: 'neurosynth_untagged_tag',
                                    label: 'untagged studies',
                                    isExclusionTag: false,
                                },
                                {
                                    id: 'neurosynth_special_tag',
                                    label: 'Special',
                                    isExclusionTag: false,
                                },
                                {
                                    id: 'neurosynth_save_for_later_tag',
                                    label: 'Save For Later',
                                    isExclusionTag: false,
                                },
                                {
                                    id: 'neurosynth_duplicate_exclusion',
                                    label: 'Duplicate',
                                    isExclusionTag: true,
                                },
                                {
                                    id: 'neurosynth_irrelevant_exclusion',
                                    label: 'Irrelevant',
                                    isExclusionTag: true,
                                },
                            ],
                        },
                    },
                },
            },
            options
        );
    };

    const curationMetadataExists = !!curationMetadata;

    return (
        <Step {...stepProps} expanded={true} sx={ProjectStepComponentsStyles.step}>
            <StepLabel>
                <Typography color="primary" variant="h6">
                    <b>Curation</b>: Import, organize, and include studies of interest
                </Typography>
            </StepLabel>
            <StepContent>
                <Box sx={{ marginLeft: '2rem' }}>
                    <Typography sx={{ color: 'muted.main' }}>
                        <b>The first step when creating a meta-analysis</b>
                    </Typography>
                    <Typography gutterBottom sx={{ color: 'muted.main' }}>
                        In this step, import studies from PubMed, tag studies, and either exclude or
                        include studies into your meta-analysis
                    </Typography>
                    <Box sx={{ marginTop: '1rem' }}>
                        {curationMetadataExists ? (
                            <Box sx={[ProjectStepComponentsStyles.stepCard]}>
                                <Card sx={{ width: '100%', height: '100%' }}>
                                    <CardContent>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                position: 'relative',
                                            }}
                                        >
                                            <Typography sx={{ color: 'muted.main' }}>
                                                {curationSummary.total} studies
                                            </Typography>
                                            <CircularProgress
                                                sx={{
                                                    position: 'absolute',
                                                    right: 0,
                                                    backgroundColor: '#ededed',
                                                    borderRadius: '50%',
                                                }}
                                                variant="determinate"
                                                value={
                                                    curationSummary.total === 0
                                                        ? 0
                                                        : (curationSummary.included +
                                                              curationSummary.excluded) /
                                                          curationSummary.total
                                                }
                                            />
                                        </Box>
                                        <Typography
                                            gutterBottom
                                            variant="h5"
                                            sx={{ marginRight: '40px' }}
                                        >
                                            Study Curation Summary
                                        </Typography>
                                        <Box sx={ProjectStepComponentsStyles.statusContainer}>
                                            <Box
                                                sx={ProjectStepComponentsStyles.statusIconContainer}
                                            >
                                                <CheckIcon
                                                    sx={{
                                                        color: 'success.main',
                                                        marginBottom: '5px',
                                                    }}
                                                />
                                                <Typography sx={{ color: 'success.main' }}>
                                                    {curationSummary.included} included
                                                </Typography>
                                            </Box>
                                            <Box
                                                sx={ProjectStepComponentsStyles.statusIconContainer}
                                            >
                                                <QuestionMarkIcon
                                                    sx={{
                                                        color: 'warning.dark',
                                                        marginBottom: '5px',
                                                    }}
                                                />
                                                <Typography sx={{ color: 'warning.dark' }}>
                                                    {curationSummary.uncategorized} uncategorized
                                                </Typography>
                                            </Box>
                                            <Box
                                                sx={ProjectStepComponentsStyles.statusIconContainer}
                                            >
                                                <CloseIcon
                                                    sx={{
                                                        color: 'error.dark',
                                                        marginBottom: '5px',
                                                    }}
                                                />
                                                <Typography sx={{ color: 'error.dark' }}>
                                                    {curationSummary.excluded} excluded
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </CardContent>
                                    <CardActions>
                                        <Button
                                            onClick={() =>
                                                history.push(`/projects/${projectId}/curation`)
                                            }
                                            variant="text"
                                        >
                                            continue editing
                                        </Button>
                                    </CardActions>
                                </Card>
                            </Box>
                        ) : (
                            <Box
                                sx={[
                                    ProjectStepComponentsStyles.stepCard,
                                    ProjectStepComponentsStyles.getStartedContainer,
                                    { borderColor: 'primary.main' },
                                ]}
                            >
                                <CreateCurationBoardDialog
                                    onCloseDialog={() => setDialogIsOpen(false)}
                                    createButtonIsLoading={updateProjectIsLoading}
                                    onCreateCurationBoard={(curationBoardColumns: string[]) => {
                                        createBoard(curationBoardColumns, {
                                            onSuccess: () => {
                                                enqueueSnackbar(
                                                    'Curation board created successfully',
                                                    { variant: 'success' }
                                                );
                                                setDialogIsOpen(false);
                                            },
                                        });
                                    }}
                                    isOpen={dialogIsOpen}
                                />
                                <NavToolbarPopupSubMenu
                                    options={[
                                        {
                                            label: 'PRISMA Workflow',
                                            secondary:
                                                'Standard PRISMA workflow and modal use case. Curation step includes four columns: Identification, Screening, Eligibility, and Included',
                                            onClick: () =>
                                                handleCreateCreationBoard(
                                                    ECurationBoardTypes.PRISMA
                                                ),
                                        },
                                        {
                                            label: 'Simple Workflow',
                                            secondary:
                                                'Workflow for users that simply want to include all imported studies in their meta-analysi',
                                            onClick: () =>
                                                handleCreateCreationBoard(
                                                    ECurationBoardTypes.SIMPLE
                                                ),
                                        },
                                        {
                                            label: 'Custom',
                                            secondary:
                                                'Specify how many columns you want for a custom inclusion/exclusion workflow',
                                            onClick: () =>
                                                handleCreateCreationBoard(
                                                    ECurationBoardTypes.CUSTOM
                                                ),
                                        },
                                        // {
                                        //     label: 'Reuse a studyset',
                                        //     secondary:
                                        //         'Skip the curation step and run a meta-analysis on an existing studyset',
                                        //     onClick: () => {},
                                        // },
                                    ]}
                                    buttonProps={{
                                        endIcon: <KeyboardArrowDown />,
                                        sx: { width: '100%', height: '100%' },
                                    }}
                                    buttonLabel="curation: get started"
                                />
                            </Box>
                        )}
                    </Box>
                </Box>
            </StepContent>
        </Step>
    );
};

export default CurationStep;

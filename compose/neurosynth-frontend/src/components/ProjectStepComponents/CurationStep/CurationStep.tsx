import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import CloseIcon from '@mui/icons-material/Close';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
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
import { INeurosynthProject, ISource, ITag } from 'hooks/requests/useGetProjects';
import { useHistory, useParams } from 'react-router-dom';
import ProjectStepComponentsStyles from '../ProjectStepComponents.styles';
import useUpdateProject from 'hooks/requests/useUpdateProject';
import { ICurationColumn } from 'components/CurationComponents/CurationColumn/CurationColumn';
import { useState } from 'react';
import CreateCurationBoardDialog from 'components/Dialogs/CreateCurationBoardDialog/CreateCurationBoardDialog';
import { MutateOptions } from 'react-query';
import { AxiosError, AxiosResponse } from 'axios';
import { ProjectReturn } from 'neurosynth-compose-typescript-sdk';
import CurationStepStyles from './CurationStep.style';
import useGetCurationSummary, { ICurationSummary } from 'hooks/useGetCurationSummary';
import { useSnackbar } from 'notistack';

enum ECurationBoardTypes {
    PRISMA,
    SIMPLE,
    CUSTOM,
    SKIP,
}

export enum ENeurosynthTagIds {
    UNTAGGED_TAG_ID = 'neurosynth_untagged_tag', // default info tag
    SAVE_FOR_LATER_TAG_ID = 'neurosynth_save_for_later_tag', // default info tag
    UNCATEGORIZED_ID = 'neurosynth_uncategorized_tag', // default info tag

    DUPLICATE_EXCLUSION_ID = 'neurosynth_duplicate_exclusion', // default exclusion
    IRRELEVANT_EXCLUSION_ID = 'neurosynth_irrelevant_exclusion', // default exclusion
    REPORTS_NOT_RETRIEVED_EXCLUSION_ID = 'neurosynth_reports_not_retrieved_exclusion', // default exclusion
    EXCLUDE_EXCLUSION_ID = 'neurosynth_exclude_exclusion', // default exclusion
    OUT_OF_SCOPE_EXCLUSION_ID = 'neurosynth_out_of_scope_exclusion', // default exclusion
    INSUFFICIENT_DETAIL_EXCLUSION_ID = 'neurosynth_insufficient_detail_exclusion', // default exclusion
    LIMITED_RIGOR_EXCLUSION_ID = 'neurosynth_limited_rigor', // default exclusion
}

export enum ENeurosynthSourceIds {
    NEUROSTORE = 'neurosynth_neurostore_id_source',
    PUBMED = 'neurosynth_pubmed_id_source',
}

interface ICurationStep {
    hasCurationMetadata: boolean;
}

const defaultIdentificationSources: ISource[] = [
    {
        id: ENeurosynthSourceIds.NEUROSTORE,
        label: 'Neurostore',
    },
    {
        id: ENeurosynthSourceIds.PUBMED,
        label: 'PubMed',
    },
];

const defaultInfoTags: ITag[] = [
    {
        id: ENeurosynthTagIds.UNTAGGED_TAG_ID,
        label: 'Untagged studies',
        isExclusionTag: false,
        isAssignable: false,
    },
    {
        id: ENeurosynthTagIds.UNCATEGORIZED_ID,
        label: 'Uncategorized Studies',
        isExclusionTag: false,
        isAssignable: false,
    },
    {
        id: ENeurosynthTagIds.SAVE_FOR_LATER_TAG_ID,
        label: 'Save For Later',
        isExclusionTag: false,
        isAssignable: false,
    },
];

const getPercentageComplete = (curationSummary: ICurationSummary): number => {
    if (curationSummary.total === 0) return 0;
    const percentageComplete =
        ((curationSummary.included + curationSummary.excluded) / curationSummary.total) * 100;
    return Math.round(percentageComplete);
};

const CurationStep: React.FC<ICurationStep & StepProps> = (props) => {
    const { enqueueSnackbar } = useSnackbar();
    const { projectId }: { projectId: string } = useParams();
    const curationSummary = useGetCurationSummary(projectId);
    const history = useHistory();
    const { hasCurationMetadata, ...stepProps } = props;
    const [dialogIsOpen, setDialogIsOpen] = useState(false);

    const { mutate, isLoading: updateProjectIsLoading } = useUpdateProject();

    const handleCreateCreationBoard = (curationBoardType: ECurationBoardTypes) => {
        switch (curationBoardType) {
            case ECurationBoardTypes.PRISMA:
                createBoard(['identification', 'screening', 'eligibility', 'included'], true);
                break;
            case ECurationBoardTypes.SIMPLE:
                createBoard(['included'], false);
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
        isPRISMA: boolean,
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

        const newProject: INeurosynthProject = {
            provenance: {
                curationMetadata: {
                    columns: columns,
                    prismaConfig: {
                        isPrisma: isPRISMA,
                        identification: { exclusionTags: [] },
                        screening: { exclusionTags: [] },
                        eligibility: { exclusionTags: [] },
                    },
                    exclusionTags: [
                        {
                            id: ENeurosynthTagIds.EXCLUDE_EXCLUSION_ID,
                            label: 'Exclude',
                            isExclusionTag: true,
                            isAssignable: true,
                        },
                        {
                            id: ENeurosynthTagIds.DUPLICATE_EXCLUSION_ID,
                            label: 'Duplicate',
                            isExclusionTag: true,
                            isAssignable: true,
                        },
                    ],
                    infoTags: defaultInfoTags,
                    identificationSources: defaultIdentificationSources,
                },
            },
        };

        if (isPRISMA && newProject?.provenance?.curationMetadata) {
            const prismaConfig = newProject.provenance.curationMetadata.prismaConfig;
            prismaConfig.identification.exclusionTags = [
                {
                    id: ENeurosynthTagIds.DUPLICATE_EXCLUSION_ID,
                    label: 'Duplicate',
                    isExclusionTag: true,
                    isAssignable: true,
                },
            ];
            prismaConfig.screening.exclusionTags = [
                {
                    id: ENeurosynthTagIds.REPORTS_NOT_RETRIEVED_EXCLUSION_ID,
                    label: 'Reports not retrieved',
                    isExclusionTag: true,
                    isAssignable: true,
                },
                {
                    id: ENeurosynthTagIds.IRRELEVANT_EXCLUSION_ID,
                    label: 'Irrelevant',
                    isExclusionTag: true,
                    isAssignable: true,
                },
            ];
            prismaConfig.eligibility.exclusionTags = [
                {
                    id: ENeurosynthTagIds.INSUFFICIENT_DETAIL_EXCLUSION_ID,
                    label: 'Insufficient Details',
                    isExclusionTag: true,
                    isAssignable: true,
                },
                {
                    id: ENeurosynthTagIds.LIMITED_RIGOR_EXCLUSION_ID,
                    label: 'Limited Rigor',
                    isExclusionTag: true,
                    isAssignable: true,
                },
                {
                    id: ENeurosynthTagIds.OUT_OF_SCOPE_EXCLUSION_ID,
                    label: 'Out of scope',
                    isExclusionTag: true,
                    isAssignable: true,
                },
            ];
        }

        mutate(
            {
                projectId,
                project: newProject,
            },
            {
                onSuccess: () => {
                    history.push(`/projects/${projectId}/curation`);
                    enqueueSnackbar('curation board create successfully', { variant: 'success' });
                },
                ...options,
            }
        );
    };

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
                        {props.hasCurationMetadata ? (
                            <Box sx={[ProjectStepComponentsStyles.stepCard]}>
                                <Card sx={{ width: '100%', height: '100%' }}>
                                    <CardContent>
                                        <Box sx={ProjectStepComponentsStyles.stepTitle}>
                                            <Typography sx={{ color: 'muted.main' }}>
                                                {curationSummary.total} studies
                                            </Typography>
                                            <CircularProgress
                                                color={
                                                    getPercentageComplete(curationSummary) === 100
                                                        ? 'success'
                                                        : 'secondary'
                                                }
                                                sx={ProjectStepComponentsStyles.progressCircle}
                                                variant="determinate"
                                                value={getPercentageComplete(curationSummary)}
                                            />
                                        </Box>
                                        <Typography gutterBottom variant="h5">
                                            Study Curation Summary
                                        </Typography>
                                        <Box sx={ProjectStepComponentsStyles.statusContainer}>
                                            <Box
                                                sx={ProjectStepComponentsStyles.statusIconContainer}
                                            >
                                                <PlaylistAddCheckIcon
                                                    sx={CurationStepStyles.checkIcon}
                                                />
                                                <Typography sx={{ color: 'success.main' }}>
                                                    {curationSummary.included} included
                                                </Typography>
                                            </Box>
                                            <Box
                                                sx={ProjectStepComponentsStyles.statusIconContainer}
                                            >
                                                <CloseIcon sx={CurationStepStyles.closeIcon} />
                                                <Typography sx={{ color: 'error.dark' }}>
                                                    {curationSummary.excluded} excluded
                                                </Typography>
                                            </Box>
                                            <Box
                                                sx={ProjectStepComponentsStyles.statusIconContainer}
                                            >
                                                <QuestionMarkIcon
                                                    sx={CurationStepStyles.questionMarkIcon}
                                                />
                                                <Typography sx={{ color: 'warning.dark' }}>
                                                    {curationSummary.uncategorized} uncategorized
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
                                        createBoard(curationBoardColumns, false);
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

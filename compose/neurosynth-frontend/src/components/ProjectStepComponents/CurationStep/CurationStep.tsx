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
import { useHistory, useParams } from 'react-router-dom';
import ProjectStepComponentsStyles from '../ProjectStepComponents.styles';
import { useState } from 'react';
import CreateCurationBoardDialog from 'components/Dialogs/CreateCurationBoardDialog/CreateCurationBoardDialog';
import CurationStepStyles from './CurationStep.style';
import useGetCurationSummary, { ICurationSummary } from 'hooks/useGetCurationSummary';
import { useInitCuration } from 'pages/Projects/ProjectPage/ProjectStore';

enum ECurationBoardTypes {
    PRISMA,
    SIMPLE,
    CUSTOM,
    SKIP,
}

export enum ENeurosynthTagIds {
    UNTAGGED_TAG_ID = 'neurosynth_untagged_tag', // default info tag
    NEEDS_REVIEW_TAG_ID = 'neurosynth_needs_review_tag', // default info tag
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
    SCOPUS = 'neurosynth_scopus_id_source',
    WEBOFSCIENCE = 'neurosynth_web_of_science_id_source',
    PSYCINFO = 'neurosynth_psycinfo_id_source',
}

const getPercentageComplete = (curationSummary: ICurationSummary): number => {
    if (curationSummary.total === 0) return 0;
    const percentageComplete =
        ((curationSummary.included + curationSummary.excluded) / curationSummary.total) * 100;
    return Math.round(percentageComplete);
};

interface ICurationStep {
    curationStepHasBeenInitialized: boolean;
}

const CurationStep: React.FC<ICurationStep & StepProps> = (props) => {
    const { projectId }: { projectId: string } = useParams();
    const curationSummary = useGetCurationSummary();
    const history = useHistory();
    const [dialogIsOpen, setDialogIsOpen] = useState(false);
    const { curationStepHasBeenInitialized, ...stepProps } = props;

    const initCuration = useInitCuration();

    const handleCreateCreationBoard = (curationBoardType: ECurationBoardTypes) => {
        switch (curationBoardType) {
            case ECurationBoardTypes.PRISMA:
                createBoard(['identification', 'screening', 'eligibility', 'included'], true);
                break;
            case ECurationBoardTypes.SIMPLE:
                createBoard(['not included', 'included'], false);
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

    const createBoard = (curationBoardInitColumns: string[], isPRISMA: boolean) => {
        if (!projectId) return;

        initCuration(curationBoardInitColumns, isPRISMA);
        history.push(`/projects/${projectId}/curation`);
    };

    return (
        <Step {...stepProps} expanded={true} sx={ProjectStepComponentsStyles.step}>
            <StepLabel>
                <Typography color="primary" variant="h6">
                    <b>Search & Curate</b>: Import, exclude, and include studies of interest
                </Typography>
            </StepLabel>
            <StepContent>
                <Box sx={{ marginLeft: '2rem' }}>
                    <Typography sx={{ color: 'muted.main' }}>
                        <b>The first step in creating a meta-analysis</b>
                    </Typography>
                    <Typography gutterBottom sx={{ color: 'muted.main' }}>
                        In this step, import studies from PubMed, tag studies, and either exclude or
                        include studies into your meta-analysis
                    </Typography>
                    <Box sx={{ marginTop: '1rem' }}>
                        {curationStepHasBeenInitialized ? (
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
                                    createButtonIsLoading={false}
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
                                                'Workflow involving only two columns for users looking to simply include/exclude studies for their meta-analysis',
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
                                        // { TBD
                                        //     label: 'Semi-Automated Meta-Analysis',
                                        //     secondary:
                                        //         'All imported studies will be automatically included',
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

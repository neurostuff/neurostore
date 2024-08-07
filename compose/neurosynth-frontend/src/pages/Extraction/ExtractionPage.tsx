import BookmarkIcon from '@mui/icons-material/Bookmark';
import CheckIcon from '@mui/icons-material/Check';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import { Box, Button, Chip, Typography } from '@mui/material';
import NeurosynthBreadcrumbs from 'components/NeurosynthBreadcrumbs';
import ProjectIsLoadingText from 'components/ProjectIsLoadingText';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import TextEdit from 'components/TextEdit/TextEdit';
import { useGetStudysetById, useUpdateStudyset } from 'hooks';
import useGetExtractionSummary from 'hooks/useGetExtractionSummary';
import useGetWindowHeight from 'hooks/useGetWindowHeight';
import useUserCanEdit from 'hooks/useUserCanEdit';
import { StudyReturn } from 'neurostore-typescript-sdk';
import ExtractionOutOfSync from 'pages/Extraction/components/ExtractionOutOfSync';
import ReadOnlyStudySummaryVirtualizedItem from 'pages/Extraction/components/ReadOnlyStudySummary';
import { resolveStudysetAndCurationDifferences } from 'pages/Extraction/Extraction.helpers';
import { IProjectPageLocationState } from 'pages/Project/ProjectPage';
import {
    useGetProjectIsLoading,
    useInitProjectStoreIfRequired,
    useProjectCurationColumns,
    useProjectExtractionStudyStatusList,
    useProjectExtractionStudysetId,
    useProjectMetaAnalysisCanEdit,
    useProjectName,
    useProjectUser,
} from 'pages/Project/store/ProjectStore';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FixedSizeList, ListChildComponentProps } from 'react-window';

export enum EExtractionStatus {
    'COMPLETED' = 'completed',
    'SAVEDFORLATER' = 'savedforlater',
    'UNCATEGORIZED' = 'uncategorized',
}

const ReadOnlyStudySummaryFixedSizeListRow: React.FC<
    ListChildComponentProps<{
        studies: StudyReturn[];
        currentSelectedChip: EExtractionStatus;
        canEdit: boolean;
    }>
> = (props) => {
    const study = props.data.studies[props.index];
    const currentSelectedChip = props.data.currentSelectedChip;
    const canEdit = props.data.canEdit;

    return (
        <ReadOnlyStudySummaryVirtualizedItem
            {...study}
            canEdit={canEdit}
            currentSelectedChip={currentSelectedChip}
            style={props.style}
        />
    );
};

const ExtractionPage: React.FC = (props) => {
    const { projectId } = useParams<{ projectId: string | undefined }>();
    const navigate = useNavigate();
    const windowHeight = useGetWindowHeight();

    useInitProjectStoreIfRequired();

    const projectName = useProjectName();
    const studysetId = useProjectExtractionStudysetId();
    const studyStatusList = useProjectExtractionStudyStatusList();
    const columns = useProjectCurationColumns();
    const loading = useGetProjectIsLoading();
    const extractionSummary = useGetExtractionSummary(projectId || '');
    const canEditMetaAnalyses = useProjectMetaAnalysisCanEdit();
    const projectUser = useProjectUser();
    const canEdit = useUserCanEdit(projectUser || undefined);

    const {
        data: studyset,
        isLoading: getStudysetIsLoading,
        isRefetching: getStudysetIsRefetching,
        isError: getStudysetIsError,
    } = useGetStudysetById(studysetId, true);
    const { mutate } = useUpdateStudyset();

    const [fieldBeingUpdated, setFieldBeingUpdated] = useState('');
    const selectedChipLocalStorageKey = `SELECTED_CHIP-${projectId}`;
    const selectedChipInLocalStorage =
        (localStorage.getItem(selectedChipLocalStorageKey) as EExtractionStatus) ||
        EExtractionStatus.UNCATEGORIZED;
    const [currentChip, setCurrentChip] = useState<EExtractionStatus>(selectedChipInLocalStorage);
    const [studiesDisplayedState, setStudiesDisplayedState] = useState<{
        uncategorized: StudyReturn[];
        saveForLater: StudyReturn[];
        completed: StudyReturn[];
    }>({
        uncategorized: [],
        saveForLater: [],
        completed: [],
    });
    const [showReconcilePrompt, setShowReconcilePrompt] = useState(false);

    useEffect(() => {
        if (!loading && !getStudysetIsLoading && columns.length > 0 && studyset?.studies) {
            const includedStudies = columns[columns.length - 1].stubStudies;
            const isDifferent = resolveStudysetAndCurationDifferences(
                includedStudies,
                studyset.studies as StudyReturn[]
            );
            setShowReconcilePrompt(isDifferent);
        }
    }, [columns, getStudysetIsLoading, studyset?.studies, loading]);

    useEffect(() => {
        if (studyStatusList && studyset?.studies) {
            const map = new Map<string, EExtractionStatus>();

            studyStatusList.forEach((studyStatus) => {
                map.set(studyStatus.id, studyStatus.status);
            });

            setStudiesDisplayedState((prev) => {
                if (!prev) return prev;

                const allStudies = studyset.studies as StudyReturn[];

                const completed: StudyReturn[] = [];
                const saveForLater: StudyReturn[] = [];
                const uncategorized: StudyReturn[] = [];

                allStudies.forEach((study) => {
                    if (!study?.id) return;

                    if (map.has(study.id)) {
                        const status = map.get(study.id);
                        status === EExtractionStatus.COMPLETED
                            ? completed.push(study)
                            : saveForLater.push(study);
                    } else {
                        uncategorized.push(study);
                    }
                });

                return {
                    completed,
                    saveForLater,
                    uncategorized,
                };
            });
        }
    }, [studyStatusList, studyset?.studies]);

    const handleSelectChip = (arg: EExtractionStatus) => {
        if (projectId) {
            setCurrentChip(arg);
            localStorage.setItem(selectedChipLocalStorageKey, arg);
        }
    };

    const handleUpdateStudyset = (updatedText: string, fieldName: string) => {
        if (studysetId) {
            setFieldBeingUpdated(fieldName);
            mutate(
                {
                    studysetId: studysetId,
                    studyset: {
                        [fieldName]: updatedText,
                    },
                },
                {
                    onSettled: () => {
                        setFieldBeingUpdated('');
                    },
                }
            );
        }
    };

    const handleMoveToSpecificationPhase = () => {
        if (canEditMetaAnalyses) {
            navigate(`/projects/${projectId}/meta-analyses`);
        } else {
            navigate(`/projects/${projectId}/project`, {
                state: {
                    projectPage: {
                        scrollToMetaAnalysisProceed: true,
                    },
                } as IProjectPageLocationState,
            });
        }
    };

    const studiesDisplayed =
        currentChip === EExtractionStatus.COMPLETED
            ? studiesDisplayedState.completed
            : currentChip === EExtractionStatus.SAVEDFORLATER
            ? studiesDisplayedState.saveForLater
            : studiesDisplayedState.uncategorized;

    const text =
        currentChip === EExtractionStatus.COMPLETED
            ? 'completed'
            : currentChip === EExtractionStatus.SAVEDFORLATER
            ? 'saved for later'
            : 'uncategorized';

    const pxInVh = useMemo(() => Math.round((windowHeight * 60) / 100), [windowHeight]);

    const isReadyToMoveToNextStep = useMemo(
        () =>
            extractionSummary.total === extractionSummary.completed && extractionSummary.total > 0,
        [extractionSummary]
    );

    return (
        <StateHandlerComponent isError={getStudysetIsError} isLoading={getStudysetIsLoading}>
            <Box sx={{ minWidth: '450px', margin: '0 auto' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', marginBottom: '0.5rem' }}>
                        <NeurosynthBreadcrumbs
                            breadcrumbItems={[
                                {
                                    text: 'Projects',
                                    link: '/projects',
                                    isCurrentPage: false,
                                },
                                {
                                    text: projectName || '',
                                    link: `/projects/${projectId}`,
                                    isCurrentPage: false,
                                },
                                {
                                    text: 'Extraction',
                                    link: '',
                                    isCurrentPage: true,
                                },
                            ]}
                        />
                        <ProjectIsLoadingText isLoading={getStudysetIsRefetching} />
                    </Box>
                    <Box>
                        <Button
                            sx={{ width: '220px' }}
                            color="secondary"
                            variant="contained"
                            disableElevation
                            onClick={() =>
                                navigate(`/projects/${projectId}/extraction/annotations`)
                            }
                        >
                            View Annotations
                        </Button>
                        {isReadyToMoveToNextStep && (
                            <Button
                                sx={{ marginLeft: '1rem' }}
                                onClick={handleMoveToSpecificationPhase}
                                color="success"
                                variant="contained"
                                disableElevation
                                disabled={!canEdit}
                            >
                                Move to Specification Phase
                            </Button>
                        )}
                    </Box>
                </Box>
                {showReconcilePrompt && <ExtractionOutOfSync />}
                <Box>
                    <Box>
                        <TextEdit
                            editIconIsVisible={canEdit}
                            isLoading={fieldBeingUpdated === 'name'}
                            label="Studyset Name"
                            textFieldSx={{ input: { fontSize: '1.5rem' } }}
                            fieldName="name"
                            onSave={handleUpdateStudyset}
                            textToEdit={studyset?.name || ''}
                        >
                            <Typography variant="h5">
                                {studyset?.name || (
                                    <Box component="span" sx={{ color: 'warning.dark' }}>
                                        No name
                                    </Box>
                                )}
                            </Typography>
                        </TextEdit>
                    </Box>
                    <Box>
                        <TextEdit
                            editIconIsVisible={canEdit}
                            isLoading={fieldBeingUpdated === 'description'}
                            multiline
                            fieldName="description"
                            label="Studyset Description"
                            textFieldSx={{ fontSize: '1rem' }}
                            onSave={handleUpdateStudyset}
                            textToEdit={studyset?.description || ''}
                        >
                            <Typography
                                sx={{ color: 'muted.main', whiteSpace: 'pre-line' }}
                                variant="body1"
                            >
                                {studyset?.description || (
                                    <Box component="span" sx={{ color: 'warning.dark' }}>
                                        No description
                                    </Box>
                                )}
                            </Typography>
                        </TextEdit>
                    </Box>
                </Box>
                <Box sx={{ margin: '1rem 0', display: 'flex', justifyContent: 'space-between' }}>
                    <Box>
                        <Chip
                            size="medium"
                            onClick={() => handleSelectChip(EExtractionStatus.UNCATEGORIZED)}
                            color="warning"
                            sx={{ marginRight: '8px' }}
                            variant={
                                currentChip === EExtractionStatus.UNCATEGORIZED
                                    ? 'filled'
                                    : 'outlined'
                            }
                            icon={<QuestionMarkIcon />}
                            label={`Uncategorized (${studiesDisplayedState.uncategorized.length})`}
                        />
                        <Chip
                            size="medium"
                            onClick={() => handleSelectChip(EExtractionStatus.SAVEDFORLATER)}
                            variant={
                                currentChip === EExtractionStatus.SAVEDFORLATER
                                    ? 'filled'
                                    : 'outlined'
                            }
                            color="info"
                            sx={{ marginRight: '8px' }}
                            icon={<BookmarkIcon />}
                            label={`Save for later (${studiesDisplayedState.saveForLater.length})`}
                        />
                        <Chip
                            size="medium"
                            onClick={() => handleSelectChip(EExtractionStatus.COMPLETED)}
                            variant={
                                currentChip === EExtractionStatus.COMPLETED ? 'filled' : 'outlined'
                            }
                            color="success"
                            sx={{ marginRight: '8px' }}
                            icon={<CheckIcon />}
                            label={`Completed (${studiesDisplayedState.completed.length})`}
                        />
                    </Box>
                    <Box>
                        <Typography sx={{ textAlign: 'end' }} variant="h6">
                            {studiesDisplayed.length} studies
                        </Typography>
                    </Box>
                </Box>
                <Box
                    sx={{
                        marginBottom: '1rem',
                    }}
                >
                    {studiesDisplayed.length === 0 && (
                        <Typography sx={{ color: 'warning.dark' }}>
                            No studies marked as {text}
                        </Typography>
                    )}
                    <Box>
                        <FixedSizeList
                            height={pxInVh}
                            itemCount={studiesDisplayed.length}
                            width="100%"
                            itemSize={140}
                            itemKey={(index, data) => data.studies[index]?.id || index}
                            itemData={{
                                studies: studiesDisplayed,
                                currentSelectedChip: currentChip,
                                canEdit: canEdit,
                            }}
                            layout="vertical"
                            overscanCount={3}
                        >
                            {ReadOnlyStudySummaryFixedSizeListRow}
                        </FixedSizeList>
                    </Box>
                </Box>
            </Box>
        </StateHandlerComponent>
    );
};

export default ExtractionPage;

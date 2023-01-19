import { Box, Breadcrumbs, Typography, Link, Chip } from '@mui/material';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import TextEdit from 'components/TextEdit/TextEdit';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import CheckIcon from '@mui/icons-material/Check';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import { useGetStudysetById, useUpdateStudyset } from 'hooks';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { useEffect, useRef, useState } from 'react';
import { NavLink, useHistory, useLocation, useParams } from 'react-router-dom';
import IngestionDialog from 'components/Dialogs/IngestionDialog/IngestionDialog';
import { StudyReturn } from 'neurostore-typescript-sdk';
import StudyListItem from 'components/ExtractionComponents/StudyListItem';

enum ESelectedChip {
    'COMPLETED' = 'completed',
    'SAVEDFORLATER' = 'savedforlater',
    'UNCATEGORIZED' = 'uncategorized',
}

const getSelectedFromURL = (pathname: string | undefined): ESelectedChip => {
    if (!pathname) return ESelectedChip.UNCATEGORIZED;
    if (pathname.includes(ESelectedChip.COMPLETED)) {
        return ESelectedChip.COMPLETED;
    } else if (pathname.includes(ESelectedChip.SAVEDFORLATER)) {
        return ESelectedChip.SAVEDFORLATER;
    } else {
        return ESelectedChip.UNCATEGORIZED;
    }
};

const ExtractionPage: React.FC = (props) => {
    const { projectId }: { projectId: string | undefined } = useParams();
    const {
        data: project,
        isLoading: getProjectIsLoading,
        isError: getProjectIsError,
    } = useGetProjectById(projectId);
    const [studiesDisplayed, setStudiesDisplayed] = useState<{
        uncategorized: StudyReturn[];
        saveForLater: StudyReturn[];
        completed: StudyReturn[];
    }>({
        uncategorized: [],
        saveForLater: [],
        completed: [],
    });
    const studysetCategories = useRef<{
        completeSet: Set<string>;
        savedForLaterSet: Set<string>;
    }>({
        completeSet: new Set<string>(),
        savedForLaterSet: new Set<string>(),
    });
    const {
        data: studyset,
        isLoading: getStudysetIsLoading,
        isError: getStudysetIsError,
    } = useGetStudysetById(project?.provenance?.extractionMetadata?.studysetId, true);
    const [fieldBeingUpdated, setFieldBeingUpdated] = useState('');
    const { mutate } = useUpdateStudyset();
    const location = useLocation();
    const history = useHistory();

    const [currentChip, setCurrentChip] = useState<ESelectedChip>(
        getSelectedFromURL(location.search)
    );
    const [ingestionDialogIsOpen, setIngestionDialogIsOpen] = useState(false);

    useEffect(() => {
        if (!getStudysetIsLoading && studyset?.studies && studyset.studies.length === 0) {
            setIngestionDialogIsOpen(true);
        }
    }, [studyset, studyset?.studies, getStudysetIsLoading]);

    useEffect(() => {
        if (project?.provenance?.extractionMetadata?.studyStatusList && studyset?.studies) {
            const completeSet = new Set<string>();
            const savedForLaterSet = new Set<string>();

            (project?.provenance?.extractionMetadata?.studyStatusList || []).forEach(
                (studyStatus) => {
                    studyStatus.status === 'COMPLETE'
                        ? completeSet.add(studyStatus.id)
                        : savedForLaterSet.add(studyStatus.id);
                }
            );

            studysetCategories.current = {
                completeSet: completeSet,
                savedForLaterSet: savedForLaterSet,
            };

            setStudiesDisplayed((prev) => {
                if (!prev) return prev;

                const allStudies = studyset.studies as StudyReturn[];

                const completed: StudyReturn[] = [];
                const saveForLater: StudyReturn[] = [];
                const uncategorized: StudyReturn[] = [];

                allStudies.forEach((study) => {
                    if (completeSet.has(study?.id || '')) {
                        completed.push(study);
                    } else if (savedForLaterSet.has(study?.id || '')) {
                        saveForLater.push(study);
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
    }, [project?.provenance?.extractionMetadata?.studyStatusList, studyset?.studies]);

    const handleSelectChip = (arg: ESelectedChip) => {
        setCurrentChip(arg);
        history.push(`/projects/${projectId}/extraction?${arg}`);
    };

    const handleUpdateStudyset = (updatedText: string, fieldName: string) => {
        if (project?.provenance?.extractionMetadata?.studysetId) {
            setFieldBeingUpdated(fieldName);
            mutate(
                {
                    studysetId: project.provenance.extractionMetadata.studysetId,
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

    return (
        <StateHandlerComponent
            isError={getProjectIsError || getStudysetIsError}
            isLoading={getProjectIsLoading || getStudysetIsLoading}
        >
            <IngestionDialog
                isOpen={ingestionDialogIsOpen}
                onCloseDialog={() => setIngestionDialogIsOpen(false)}
            />
            <Box sx={{ width: '80%', minWidth: '450px', margin: '0 auto' }}>
                <Box sx={{ display: 'flex', marginBottom: '0.5rem' }}>
                    <Breadcrumbs>
                        <Link
                            component={NavLink}
                            to="/projects"
                            sx={{ cursor: 'pointer', fontSize: '1.5rem' }}
                            underline="hover"
                        >
                            Projects
                        </Link>
                        <Link
                            component={NavLink}
                            to={`/projects/${projectId}`}
                            sx={{ cursor: 'pointer', fontSize: '1.5rem' }}
                            underline="hover"
                        >
                            {project?.name || ''}
                        </Link>
                        <Typography color="secondary" sx={{ fontSize: '1.5rem' }}>
                            Extraction
                        </Typography>
                    </Breadcrumbs>
                </Box>
                <Box>
                    <Box>
                        <TextEdit
                            editIconIsVisible={true}
                            isLoading={fieldBeingUpdated === 'name'}
                            label="Studyset Name"
                            sx={{ input: { fontSize: '1.5rem' } }}
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
                            editIconIsVisible={true}
                            isLoading={fieldBeingUpdated === 'description'}
                            multiline
                            fieldName="description"
                            label="Studyset Description"
                            sx={{ fontSize: '1rem' }}
                            onSave={handleUpdateStudyset}
                            textToEdit={studyset?.description || ''}
                        >
                            <Typography sx={{ color: 'muted.main' }} variant="body1">
                                {studyset?.description || (
                                    <Box component="span" sx={{ color: 'warning.dark' }}>
                                        No description
                                    </Box>
                                )}
                            </Typography>
                        </TextEdit>
                    </Box>
                </Box>
                {/* <Box sx={{ margin: '1rem 0' }}>
                    <FormControl sx={{ width: '100%', marginTop: '2px' }}>
                        <InputLabel>search</InputLabel>
                        <OutlinedInput
                            onChange={handleInputSearch}
                            value={searchTerm}
                            label="search"
                            endAdornment={<SearchIcon color="primary" />}
                        />
                    </FormControl>
                </Box> */}
                <Box sx={{ marginTop: '1rem' }}>
                    <Chip
                        size="medium"
                        onClick={() => handleSelectChip(ESelectedChip.UNCATEGORIZED)}
                        color="warning"
                        sx={{ marginRight: '8px' }}
                        variant={
                            currentChip === ESelectedChip.UNCATEGORIZED ? 'filled' : 'outlined'
                        }
                        icon={<QuestionMarkIcon />}
                        label="Uncategorized"
                    />
                    <Chip
                        size="medium"
                        onClick={() => handleSelectChip(ESelectedChip.SAVEDFORLATER)}
                        variant={
                            currentChip === ESelectedChip.SAVEDFORLATER ? 'filled' : 'outlined'
                        }
                        color="info"
                        sx={{ marginRight: '8px' }}
                        icon={<BookmarkIcon />}
                        label="Save for later"
                    />
                    <Chip
                        size="medium"
                        onClick={() => handleSelectChip(ESelectedChip.COMPLETED)}
                        variant={currentChip === ESelectedChip.COMPLETED ? 'filled' : 'outlined'}
                        color="success"
                        sx={{ marginRight: '8px' }}
                        icon={<CheckIcon />}
                        label="Completed"
                    />
                </Box>
                <Box
                    sx={{
                        margin: '1rem 0',
                        display: currentChip === ESelectedChip.COMPLETED ? 'block' : 'none',
                    }}
                >
                    {studiesDisplayed.completed.map((study, index) => (
                        <StudyListItem key={study?.id || ''} status="COMPLETE" {...study} />
                    ))}
                    {studiesDisplayed.completed.length === 0 && (
                        <Typography sx={{ color: 'warning.dark' }}>
                            No studies marked as complete
                        </Typography>
                    )}
                </Box>
                <Box
                    sx={{
                        margin: '1rem 0',
                        display: currentChip === ESelectedChip.SAVEDFORLATER ? 'block' : 'none',
                    }}
                >
                    {studiesDisplayed.saveForLater.map((study, index) => (
                        <StudyListItem key={study?.id || ''} status="SAVEFORLATER" {...study} />
                    ))}
                    {studiesDisplayed.saveForLater.length === 0 && (
                        <Typography sx={{ color: 'warning.dark' }}>
                            No studies marked as saved for later
                        </Typography>
                    )}
                </Box>
                <Box
                    sx={{
                        margin: '1rem 0',
                        display: currentChip === ESelectedChip.UNCATEGORIZED ? 'block' : 'none',
                    }}
                >
                    {studiesDisplayed.uncategorized.map((study, index) => (
                        <StudyListItem key={study?.id || ''} status="UNCATEGORIZED" {...study} />
                    ))}
                    {studiesDisplayed.uncategorized.length === 0 && (
                        <Typography sx={{ color: 'warning.dark' }}>
                            No uncategorized studies
                        </Typography>
                    )}
                </Box>
            </Box>
        </StateHandlerComponent>
    );
};

export default ExtractionPage;

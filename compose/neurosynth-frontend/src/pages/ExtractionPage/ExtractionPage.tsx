import {
    Box,
    Breadcrumbs,
    Typography,
    Link,
    InputLabel,
    OutlinedInput,
    FormControl,
    Chip,
} from '@mui/material';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import TextEdit from 'components/TextEdit/TextEdit';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import CheckIcon from '@mui/icons-material/Check';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import SearchIcon from '@mui/icons-material/Search';
import { useGetStudysetById } from 'hooks';
import useGetProjectById from 'hooks/requests/useGetProjectById';
import { useEffect, useState } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import IngestionDialog from 'components/Dialogs/IngestionDialog/IngestionDialog';
import { StudyReturn } from 'neurostore-typescript-sdk';

enum ESelectedChip {
    'COMPLETED',
    'SAVEDFORLATER',
    'UNCATEGORIZED',
}

const ExtractionPage: React.FC = (props) => {
    const { projectId }: { projectId: string | undefined } = useParams();
    const {
        data: project,
        isLoading: getProjectIsLoading,
        isError: getProjectIsError,
    } = useGetProjectById(projectId);
    const {
        data: studyset,
        isLoading: getStudysetIsLoading,
        isError: getStudysetIsError,
    } = useGetStudysetById(project?.provenance?.extractionMetadata?.studysetId, false);

    const [currentChip, setCurrentChip] = useState<ESelectedChip>(ESelectedChip.UNCATEGORIZED);
    const [ingestionDialogIsOpen, setIngestionDialogIsOpen] = useState(false);

    useEffect(() => {
        if (!getStudysetIsLoading && studyset?.studies && studyset.studies.length === 0) {
            setIngestionDialogIsOpen(true);
        }
    }, [studyset, studyset?.studies, getStudysetIsLoading]);

    const handleSelectChip = (arg: ESelectedChip) => {
        setCurrentChip(arg);
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
            <Box sx={{ width: '70%', minWidth: '450px', margin: '0 auto' }}>
                <Box sx={{ display: 'flex', marginBottom: '1rem' }}>
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
                    <Box sx={{ marginBottom: '0.5rem' }}>
                        <TextEdit
                            editIconIsVisible={true}
                            isLoading={false}
                            label="Studyset Name"
                            sx={{ input: { fontSize: '1.5rem' } }}
                            onSave={() => {}}
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
                            isLoading={false}
                            multiline
                            label="Studyset Description"
                            sx={{ fontSize: '1rem' }}
                            onSave={() => {}}
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
                <Box sx={{ margin: '1rem 0' }}>
                    <FormControl sx={{ width: '100%', marginTop: '2px' }}>
                        <InputLabel>search</InputLabel>
                        <OutlinedInput
                            label="search"
                            endAdornment={<SearchIcon color="primary" />}
                        />
                    </FormControl>
                </Box>
                <Box>
                    <Chip
                        size="medium"
                        onClick={() => handleSelectChip(ESelectedChip.UNCATEGORIZED)}
                        color="warning"
                        sx={{ marginRight: '5px' }}
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
                        sx={{ marginRight: '5px' }}
                        icon={<BookmarkIcon />}
                        label="Save for later"
                    />
                    <Chip
                        size="medium"
                        onClick={() => handleSelectChip(ESelectedChip.COMPLETED)}
                        variant={currentChip === ESelectedChip.COMPLETED ? 'filled' : 'outlined'}
                        color="success"
                        sx={{ marginRight: '5px' }}
                        icon={<CheckIcon />}
                        label="Completed"
                    />
                </Box>
                <Box sx={{ margin: '1rem 0' }}>
                    {((studyset?.studies as StudyReturn[]) || []).map((study, index) => (
                        <Typography variant="h6" key={study.id || index}>
                            {study.name}
                        </Typography>
                    ))}
                </Box>
            </Box>
        </StateHandlerComponent>
    );
};

export default ExtractionPage;

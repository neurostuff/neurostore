import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { StudyReturn } from 'neurostore-typescript-sdk';
import StudyListItemStyles from './StudyListItem.styles';
import CheckIcon from '@mui/icons-material/Check';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import TextExpansion from 'components/TextExpansion/TextExpansion';
import { useHistory, useParams } from 'react-router-dom';
import useUpdateProject from 'hooks/requests/useUpdateProject';
import useGetProjectById from 'hooks/requests/useGetProjectById';

const StudyListItem: React.FC<
    StudyReturn & { status: 'COMPLETE' | 'SAVEFORLATER' | 'UNCATEGORIZED' }
> = (props) => {
    const { projectId }: { projectId: string } = useParams();
    const { data: project } = useGetProjectById(projectId);
    const { mutate } = useUpdateProject();
    const history = useHistory();

    const handleClick = (_event: React.MouseEvent) => {
        if (props?.id) {
            history.push(`/projects/${projectId}/extraction/studies/${props.id}`);
        }
    };

    const handleUpdateStatus = (studyId: string, status: 'COMPLETE' | 'SAVEFORLATER') => {
        if (studyId && project?.provenance?.extractionMetadata?.studyStatusList) {
            const updatedStudyList = [...project.provenance.extractionMetadata.studyStatusList];
            const studyIndex = updatedStudyList.findIndex((x) => x.id === studyId);
            if (studyIndex < 0) {
                updatedStudyList.push({
                    id: studyId,
                    status: status,
                });
            } else {
                const updatedStudyStatus = { ...updatedStudyList[studyIndex], status: status };
                updatedStudyList[studyIndex] = updatedStudyStatus;
            }

            mutate({
                projectId: projectId,
                project: {
                    provenance: {
                        ...project.provenance,
                        extractionMetadata: {
                            ...project.provenance.extractionMetadata,
                            studyStatusList: updatedStudyList,
                        },
                    },
                },
            });
        }
    };

    return (
        <Box sx={StudyListItemStyles.listItem}>
            <Box sx={{ width: 'calc(100% - 80px)' }}>
                <Box onClick={handleClick} sx={{ padding: '0 1rem' }}>
                    <Typography color="primary" variant="h5">
                        {`${props.year ? `(${props.year}) ` : ''}${props.name}`}
                    </Typography>
                    <Typography color="secondary">{props.authors}</Typography>
                    <Typography>Journal: {props.publication}</Typography>
                    <Typography>DOI: {props.doi}</Typography>
                </Box>
            </Box>
            <Box
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '80px',
                }}
            >
                {(props.status === 'UNCATEGORIZED' || props.status === 'SAVEFORLATER') && (
                    <Box sx={{ marginBottom: '1rem' }}>
                        <Tooltip title="mark as complete">
                            <IconButton
                                size="large"
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleUpdateStatus(props.id || '', 'COMPLETE');
                                }}
                            >
                                <CheckIcon color="success" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                )}
                {(props.status === 'UNCATEGORIZED' || props.status === 'COMPLETE') && (
                    <Box>
                        <Tooltip title="save for later">
                            <IconButton
                                size="large"
                                onClick={(e) => {
                                    e.preventDefault();
                                    handleUpdateStatus(props.id || '', 'SAVEFORLATER');
                                }}
                            >
                                <BookmarkIcon color="info" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default StudyListItem;

import { Box, Button, Tooltip, Typography } from '@mui/material';
import DisplayLink from 'components/DisplayStudyLink/DisplayLink';
import DisplayStudyLinkFullText from 'components/DisplayStudyLink/DisplayStudyLinkFullText';
import { PUBMED_ARTICLE_URL_PREFIX, PUBMED_CENTRAL_ARTICLE_URL_PREFIX } from 'hooks/external/useFetchPubMedIds.types';
import { useGetStudyNonNestedById } from 'hooks';
import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import EditStudyDetailsDialogIBMA from './EditStudyDetailsDialogIBMA';
import EditIcon from '@mui/icons-material/Edit';

const EditStudyPageHeaderNext: React.FC = () => {
    const { studyId } = useParams<{ projectId: string; studyId: string }>();
    const { data: study } = useGetStudyNonNestedById(studyId);

    const [studyDetailsDialogOpen, setStudyDetailsDialogOpen] = useState(false);

    const createdAt = study?.created_at;
    const lastUpdatedAt = study?.updated_at ? study.updated_at : study?.created_at;
    const studyName = study?.name;
    const studyYear = study?.year;
    const studyAuthors = study?.authors;
    const studyOwnerUsername = study?.username ?? study?.user;
    const doi = study?.doi;
    const pmid = study?.pmid;
    const pmcid = study?.pmcid;

    const nicelyFormattedCreatedAt = useMemo(() => {
        const date = new Date(createdAt || '');
        return date.toDateString() + ' ' + date.toLocaleTimeString();
    }, [createdAt]);

    const nicelyFormattedLastUpdated = useMemo(() => {
        const date = new Date(lastUpdatedAt || '');
        return date.toDateString() + ' ' + date.toLocaleTimeString();
    }, [lastUpdatedAt]);

    return (
        <Box sx={{ width: '100%' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', margin: '0.3rem 0' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="h5" gutterBottom className="line-clamp-1">
                        {studyYear && `(${studyYear}).`} {studyName}
                    </Typography>
                    <Box>
                        <Button
                            sx={{ whiteSpace: 'nowrap' }}
                            size="small"
                            variant="outlined"
                            color="secondary"
                            disableElevation
                            onClick={() => setStudyDetailsDialogOpen(true)}
                        >
                            <EditIcon sx={{ fontSize: '1.2rem', mr: 1 }} />
                            Study Details
                        </Button>
                        <EditStudyDetailsDialogIBMA
                            isOpen={studyDetailsDialogOpen}
                            onClose={() => setStudyDetailsDialogOpen(false)}
                        />
                    </Box>
                </Box>
                {studyAuthors && (
                    <Typography variant="body2" gutterBottom sx={{ color: 'muted.main' }} className="line-clamp-1">
                        Authors: {studyAuthors}
                    </Typography>
                )}
                <Typography variant="body2" gutterBottom sx={{ color: 'muted.main' }} className="line-clamp-1">
                    Study owner: {studyOwnerUsername ? studyOwnerUsername : 'neurosynth'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'muted.main' }} className="line-clamp-1">
                    Last updated: {nicelyFormattedLastUpdated}
                </Typography>
                <Typography variant="body2" gutterBottom sx={{ color: 'muted.main' }} className="line-clamp-1">
                    Created: {nicelyFormattedCreatedAt}
                </Typography>
            </Box>
            <Box sx={{ display: 'flex' }}>
                {doi && <DisplayLink sx={{ marginRight: '1rem' }} label="DOI Link" href={`https://doi.org/${doi}`} />}
                {pmid && (
                    <DisplayLink
                        sx={{ marginRight: '1rem' }}
                        label="Pubmed Study"
                        href={`${PUBMED_ARTICLE_URL_PREFIX}${pmid}`}
                    />
                )}
                {pmcid && (
                    <Tooltip placement="top" title="View the full article in HTML form via PubMed Central">
                        <>
                            <DisplayLink
                                sx={{ marginRight: '1rem' }}
                                label="Full Text (web)"
                                href={`${PUBMED_CENTRAL_ARTICLE_URL_PREFIX}${pmcid}`}
                            />
                        </>
                    </Tooltip>
                )}
                {studyName && <DisplayStudyLinkFullText sx={{ marginRight: '1rem' }} studyName={studyName} />}
            </Box>
        </Box>
    );
};

export default EditStudyPageHeaderNext;

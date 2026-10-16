import { AppBar, Box, Container, List, ListItemButton, ListItemText, Toolbar, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { usePapers } from '../api/context';
import type { PaperSummary, ReviewerProgress } from '../api/reviewApi';
import { Brand } from '../Brand';
import { WhenLoaded } from './WhenLoaded';

const reviewedShare = (reviewed: number, total: number) =>
    total === 0 ? '—' : `${Math.round((reviewed / total) * 100)}%`;

const reviewerLine = (review: ReviewerProgress, total: number) =>
    `${review.user_name ?? review.user_id}: ${review.state.replace('_', ' ')}, ${review.edited} edited, ${review.verified} verified, ${reviewedShare(review.reviewed, total)} reviewed`;

function progressOf(paper: PaperSummary) {
    if (!paper.reviews?.length) return 'not started';
    return paper.reviews.map((review) => (
        <Box component="span" key={review.user_id} sx={{ display: 'block' }}>
            {reviewerLine(review, paper.total)}
        </Box>
    ));
}

export function PaperListPage() {
    const papers = usePapers();
    return (
        <>
            <AppBar position="static" elevation={0}>
                <Toolbar variant="dense">
                    <Brand />
                </Toolbar>
            </AppBar>
            <Container maxWidth="md" sx={{ py: 3 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    Papers
                </Typography>
                <WhenLoaded queries={[papers]}>
                    {([list]) => (
                        <List>
                            {list.map((paper) => (
                                <ListItemButton key={paper.id} component={RouterLink} to={`/papers/${paper.id}`}>
                                    <ListItemText
                                        primary={paper.label}
                                        secondary={
                                            <>
                                                <Box component="span" sx={{ display: 'block' }}>
                                                    {paper.id}
                                                </Box>
                                                {progressOf(paper)}
                                            </>
                                        }
                                    />
                                </ListItemButton>
                            ))}
                        </List>
                    )}
                </WhenLoaded>
            </Container>
        </>
    );
}

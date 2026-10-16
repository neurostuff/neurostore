import {
    AppBar,
    Alert,
    Box,
    Button,
    Container,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    MenuItem,
    Stack,
    TextField,
    Toolbar,
    Typography,
} from '@mui/material';
import { Fragment, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useAssignment, useMe, usePapers, useReviewers, type AssignmentMutation } from '../api/context';
import type { Assignee, Me, PaperFilter, PaperSummary, ReviewerProgress } from '../api/reviewApi';
import { Brand } from '../Brand';
import { LastEdit } from '../format/LastEdit';
import { displayName } from '../format/people';
import { SET_ASIDE_REASONS } from '../review/asideReasons';
import { WhenLoaded } from './WhenLoaded';

const reviewedShare = (reviewed: number, total: number) =>
    total === 0 ? '—' : `${Math.round((reviewed / total) * 100)}%`;

const stateLabel = (review: ReviewerProgress) => {
    const state = review.state.replace('_', ' ');
    return review.set_aside ? `${state} (${SET_ASIDE_REASONS[review.set_aside.reason]})` : state;
};

const reviewerLine = (review: ReviewerProgress, total: number) =>
    `${review.user_name ?? review.user_id}: ${stateLabel(review)}, ${review.edited} edited, ${review.verified} verified, ${reviewedShare(review.reviewed, total)} reviewed`;

function progressOf(paper: PaperSummary, now: Date) {
    if (!paper.reviews?.length) return 'not started';
    return paper.reviews.map((review) => (
        <Fragment key={review.user_id}>
            <Box component="span" sx={{ display: 'block' }}>
                {reviewerLine(review, paper.total)}
            </Box>
            {review.last_edit_at && (
                <LastEdit opCount={review.op_count} lastEditAt={review.last_edit_at} now={now} />
            )}
        </Fragment>
    ));
}

const assigneeNames = (assignees: Assignee[]) =>
    assignees.length ? `Assigned to ${assignees.map(displayName).join(', ')}` : 'Unassigned';

function Assignment({
    paper,
    me,
    reviewers,
    assign,
    release,
}: {
    paper: PaperSummary;
    me: Me | undefined;
    reviewers: Assignee[] | undefined;
    assign: AssignmentMutation;
    release: AssignmentMutation;
}) {
    if (!me) return null;
    const assignees = paper.assignees ?? [];
    const isMine = assignees.some((a) => a.user_id === me.user_id);
    const assignTo = (userId: string) => assign.mutate({ baseStudyId: paper.base_study_id, userId });
    const releaseFrom = (userId: string) => release.mutate({ baseStudyId: paper.base_study_id, userId });
    return (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <Button size="small" disabled={isMine} onClick={() => assignTo(me.user_id)}>
                Assign me
            </Button>
            {isMine && (
                <Button size="small" onClick={() => releaseFrom(me.user_id)}>
                    Release
                </Button>
            )}
            {me.lead && (
                <>
                    {assignees
                        .filter((a) => a.user_id !== me.user_id)
                        .map((a) => (
                            <Button
                                key={a.user_id}
                                size="small"
                                aria-label={`Release ${displayName(a)}`}
                                onClick={() => releaseFrom(a.user_id)}
                            >
                                Release {displayName(a)}
                            </Button>
                        ))}
                    <TextField
                        select
                        size="small"
                        label={`Assign ${paper.label} to`}
                        value=""
                        sx={{ minWidth: 200 }}
                        onChange={(event) => event.target.value && assignTo(event.target.value)}
                    >
                        {(reviewers ?? []).map((reviewer) => (
                            <MenuItem key={reviewer.user_id} value={reviewer.user_id}>
                                {displayName(reviewer)}
                            </MenuItem>
                        ))}
                    </TextField>
                </>
            )}
        </Stack>
    );
}

export function PaperListPage() {
    const [assignedToMe, setAssignedToMe] = useState(false);
    const filter: PaperFilter = assignedToMe ? { assigned: 'me' } : {};
    const papers = usePapers(filter);
    const me = useMe();
    const reviewers = useReviewers();
    const { assign, release, error } = useAssignment();
    const now = new Date();
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
                <Button
                    size="small"
                    variant={assignedToMe ? 'contained' : 'outlined'}
                    aria-pressed={assignedToMe}
                    onClick={() => setAssignedToMe(!assignedToMe)}
                    sx={{ mb: 2 }}
                >
                    Assigned to me
                </Button>
                {error && <Alert severity="error">{error.message}</Alert>}
                <WhenLoaded queries={[papers]}>
                    {([list]) => (
                        <List>
                            {list.map((paper) => (
                                <ListItem
                                    key={paper.id}
                                    disableGutters
                                    secondaryAction={
                                        <Assignment
                                            paper={paper}
                                            me={me.data}
                                            reviewers={reviewers.data}
                                            assign={assign}
                                            release={release}
                                        />
                                    }
                                >
                                    <ListItemButton component={RouterLink} to={`/papers/${paper.id}`}>
                                        <ListItemText
                                            primary={paper.label}
                                            secondary={
                                                <>
                                                    <Box component="span" sx={{ display: 'block' }}>
                                                        {paper.id}
                                                    </Box>
                                                    <Box component="span" sx={{ display: 'block' }}>
                                                        {assigneeNames(paper.assignees ?? [])}
                                                    </Box>
                                                    {progressOf(paper, now)}
                                                </>
                                            }
                                        />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </List>
                    )}
                </WhenLoaded>
            </Container>
        </>
    );
}

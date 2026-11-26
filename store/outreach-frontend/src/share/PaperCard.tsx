import { alpha, Chip, Paper, Stack, Typography } from '@mui/material';
import { paperLinks } from '../links';
import type { ShareView } from './types';

/** The paper the page is about, in a card of its own so it reads first: the title large,
 * the rest as quiet details. Fields the paper lacks are left out. */
export function PaperCard({ paper }: { paper: ShareView['paper'] }) {
    const where = [paper.journal, paper.year].filter(Boolean).join(', ');
    const links = paperLinks(paper);
    return (
        <Paper
            sx={{
                p: { xs: 3, sm: 5 },
                borderRadius: 4,
                border: 'none',
            }}
        >
            <Stack spacing={1.5}>
                <Typography
                    variant="overline"
                    color="primary"
                    sx={{ lineHeight: 1.5, fontWeight: 600, letterSpacing: '0.12em' }}
                >
                    Your paper
                </Typography>
                <Typography
                    variant="h4"
                    component="h2"
                    sx={{
                        fontWeight: 700,
                        lineHeight: 1.25,
                        letterSpacing: '-0.01em',
                    }}
                >
                    {paper.title ?? 'Untitled paper'}
                </Typography>
                {paper.authors && (
                    <Typography variant="body1" color="text.secondary">
                        {paper.authors}
                    </Typography>
                )}
                {(where || links.length > 0) && (
                    <Stack
                        direction="row"
                        spacing={1.5}
                        alignItems="center"
                        flexWrap="wrap"
                        useFlexGap
                    >
                        {where && (
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {where}
                            </Typography>
                        )}
                        {links.map((link) => (
                            <Chip
                                key={link.label}
                                size="small"
                                sx={{
                                    borderRadius: 2,
                                    fontWeight: 500,
                                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.12),
                                    color: 'primary.main',
                                    '&:hover': {
                                        bgcolor: (theme) => alpha(theme.palette.primary.main, 0.2),
                                    },
                                }}
                                clickable
                                component="a"
                                href={link.href}
                                target="_blank"
                                rel="noreferrer"
                                label={link.label}
                                title={link.title}
                            />
                        ))}
                    </Stack>
                )}
            </Stack>
        </Paper>
    );
}

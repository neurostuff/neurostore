import { Box, Button, Card, CardContent, Container, Link, Typography } from '@mui/material';
import ForumIcon from '@mui/icons-material/Forum';
import EmailIcon from '@mui/icons-material/Email';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { usePrerenderReady, usePageMetadata } from '../../../seo/hooks';

const HelpPage: React.FC = () => {
    usePrerenderReady(true);
    usePageMetadata({
        title: 'Help & Support | Neurosynth Compose',
        description:
            'Get help with Neurosynth Compose, documentation, and community support for neuroimaging meta-analysis.',
        canonicalPath: '/help',
    });

    return (
        <Box
            sx={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                py: '1.5rem',
            }}
        >
            <Container maxWidth="lg">
                <Box
                    sx={{
                        textAlign: 'center',
                        marginBottom: '2rem',
                        py: '1rem',
                    }}
                >
                    <Typography variant="h4" color="primary" gutterBottom>
                        How Can We Help?
                    </Typography>
                    <Typography variant="h6">
                        We're here to support you. Choose the best way to get in touch with us.
                    </Typography>
                </Box>

                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: { xs: 'column', md: 'row' },
                        gap: '2rem',
                    }}
                >
                    {[
                        {
                            title: 'Community Support',
                            descriptionElement: (
                                <Typography
                                    variant="body1"
                                    sx={{
                                        color: 'text.primary',
                                        marginBottom: '1rem',
                                    }}
                                >
                                    Join our community on NeuroStars to ask questions, share insights, and connect with
                                    other researchers. Get answers from both the Neurosynth team and the wider
                                    neuroscience community.
                                </Typography>
                            ),
                            icon: <ForumIcon sx={{ fontSize: '2rem', color: 'white' }} />,
                            button: {
                                label: 'Visit NeuroStars',
                                href: 'https://neurostars.org/tag/neurosynth-compose',
                            },
                        },
                        {
                            title: 'Email Support',
                            descriptionElement: (
                                <Typography
                                    variant="body1"
                                    sx={{
                                        color: 'text.primary',
                                        marginBottom: '1rem',
                                    }}
                                >
                                    Prefer direct contact? Send us an email at{' '}
                                    <Link underline="hover" href="mailto:neurosynthorg@gmail.com" fontWeight="bold">
                                        neurosynthorg@gmail.com
                                    </Link>{' '}
                                    Our team will get back to you as soon as possible to help resolve your questions or
                                    issues.
                                </Typography>
                            ),
                            icon: <EmailIcon sx={{ fontSize: '2rem', color: 'white' }} />,
                            button: {
                                label: 'Send Email',
                                href: 'mailto:neurosynthorg@gmail.com',
                            },
                        },
                    ].map(({ title, descriptionElement, icon, button }) => (
                        <Card
                            key={title}
                            elevation={2}
                            sx={{
                                flex: 1,
                                borderRadius: '16px',
                            }}
                        >
                            <CardContent
                                sx={{
                                    display: 'flex',
                                    height: '100%',
                                    boxSizing: 'border-box',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    padding: '2rem',
                                    textAlign: 'center',
                                }}
                            >
                                <Box
                                    sx={{
                                        width: '70px',
                                        height: '70px',
                                        backgroundColor: 'primary.main',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        marginBottom: '1.5rem',
                                    }}
                                >
                                    {icon}
                                </Box>
                                <Typography
                                    variant="h4"
                                    sx={{
                                        marginBottom: '1rem',
                                        color: 'primary.main',
                                    }}
                                >
                                    {title}
                                </Typography>
                                <Box>{descriptionElement}</Box>
                                <Button
                                    variant="contained"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    size="large"
                                    disableElevation
                                    endIcon={<OpenInNewIcon />}
                                    href={button.href}
                                    component="a"
                                    sx={{
                                        width: '230px',
                                        marginTop: 'auto',
                                        paddingX: '1.5rem',
                                    }}
                                >
                                    {button.label}
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </Box>

                <Box
                    sx={{
                        marginTop: '3rem',
                        textAlign: 'center',
                        padding: '1.5rem',
                        backgroundColor: 'primary.light',
                        borderRadius: '8px',
                    }}
                >
                    <Typography
                        variant="body1"
                        sx={{
                            color: 'white',
                            lineHeight: 1.8,
                        }}
                    >
                        Tip: Before reaching out, you might find answers in our{' '}
                        <Link
                            href="https://neurostuff.github.io/compose-docs/"
                            target="_blank"
                            underline="always"
                            rel="noopener noreferrer"
                            sx={{
                                textDecorationColor: 'white',
                                color: 'white',
                                fontWeight: 'bold',
                            }}
                        >
                            documentation
                        </Link>
                        .
                    </Typography>
                </Box>
            </Container>
        </Box>
    );
};

export default HelpPage;

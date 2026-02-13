import { useAuth0 } from '@auth0/auth0-react';
import AutoAwesomeMotionIcon from '@mui/icons-material/AutoAwesomeMotion';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import IosShareIcon from '@mui/icons-material/IosShare';
import OpenInNew from '@mui/icons-material/OpenInNew';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/Settings';
import { Box, Button, Card, CardContent, IconButton, Tooltip, Typography } from '@mui/material';
import NeurosynthActivitySummary from 'components/NeurosynthActivitySummary';
import { useGuard } from 'hooks';
import useAuthenticate from 'hooks/useAuthenticate';
import { useSnackbar } from 'notistack';
import { usePrerenderReady, usePageMetadata } from '../../../seo/hooks';
import PlatformComparisonTable from 'pages/LandingPage/components/PlatformComparisonTable';
import { LOGOS } from 'pages/LandingPage/LandingPage.helpers';
import LandingPageStyles from './LandingPage.styles';

const SEO_GRAPH_DATA = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
        {
            '@type': 'Organization',
            '@id': 'https://github.com/neurostuff#organization',
            name: 'Neurostuff',
            url: 'https://github.com/neurostuff',
        },
        {
            '@type': 'WebSite',
            '@id': 'https://compose.neurosynth.org/#website',
            name: 'Neurosynth Compose',
            url: 'https://compose.neurosynth.org/',
            publisher: { '@id': 'https://github.com/neurostuff#organization' },
            about: { '@id': 'https://compose.neurosynth.org/#software' },
        },
        {
            '@type': 'SoftwareApplication',
            '@id': 'https://compose.neurosynth.org/#software',
            name: 'Neurosynth Compose',
            description:
                'A web-based platform for creating, curating, and running reproducible neuroimaging meta-analyses.',
            url: 'https://compose.neurosynth.org/',
            applicationCategory: 'ScienceApplication',
            operatingSystem: 'Web',
            isAccessibleForFree: true,
            publisher: { '@id': 'https://github.com/neurostuff#organization' },
            isPartOf: {
                '@type': 'CreativeWork',
                name: 'Neurosynth ecosystem',
                url: 'https://neurosynth.org/',
                isPartOf: { '@id': 'https://github.com/neurostuff#organization' },
            },
            softwareHelp: {
                '@type': 'CreativeWork',
                name: 'Neurosynth Compose Documentation',
                url: 'https://neurostuff.github.io/compose-docs/',
            },
            subjectOf: {
                '@type': 'ScholarlyArticle',
                name: 'Neurosynth Compose: A Web-Based Platform for Flexible and Reproducible Neuroimaging Meta-Analysis',
                identifier: 'https://doi.org/10.1162/IMAG.a.1114',
            },
        },
    ],
});

const NEUROSYNTH_COMPOSE_APA_CITATION =
    'Kent, J. D., Lee, N., Laird, A. R., Salo, T., Peraza, J., Bottenhorn, K. L., Oudyk, K., Nichols, T. E., Poline, J.-B., & de la Vega, A. (2026). Neurosynth Compose: A web-based platform for flexible and reproducible neuroimaging meta-analysis. Imaging Neuroscience, 4. https://doi.org/10.1162/IMAG.a.1114';

const LandingPage = () => {
    const { isAuthenticated, isLoading } = useAuth0();
    const { enqueueSnackbar } = useSnackbar();
    useGuard('/projects', '', isAuthenticated, isLoading, true);
    const { handleLogin } = useAuthenticate();
    usePageMetadata({
        title: 'Neurosynth Compose | Neuroimaging Meta-Analysis Platform',
        description:
            'Create, curate, and run neuroimaging meta-analyses in the browser. Build studysets from published fMRI literature and execute reproducible pipelines in the cloud.',
        canonicalPath: '/',
    });
    usePrerenderReady(true);

    const handleCopyCitation = async () => {
        try {
            await navigator.clipboard.writeText(NEUROSYNTH_COMPOSE_APA_CITATION);
            enqueueSnackbar('Copied APA citation', { variant: 'success' });
        } catch {
            enqueueSnackbar('Unable to copy citation', { variant: 'error' });
        }
    };

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: SEO_GRAPH_DATA }} />
            <Box sx={[LandingPageStyles.sectionContainer, { backgroundColor: 'primary.main' }]}>
                <Box
                    sx={[
                        LandingPageStyles.sectionContents,
                        LandingPageStyles.heroBannerContentContainer,
                    ]}
                >
                    <Box sx={LandingPageStyles.heroBannerTextContainer}>
                        <Typography sx={LandingPageStyles.title} variant="h3">
                            A free and open platform for neuroimaging meta-analysis
                        </Typography>
                        <Typography variant="h5" sx={LandingPageStyles.heroBannerText}>
                            Perform custom neuroimaging meta-analyses entirely in the browser, and quickly get results
                            in the cloud using automated analysis pipelines.
                        </Typography>
                        <Box
                            sx={{
                                marginBottom: '2rem',
                                display: 'flex',
                                justifyContent: { xs: 'center', lg: 'flex-start' },
                            }}
                        >
                            <NeurosynthActivitySummary />
                        </Box>
                        <Box sx={LandingPageStyles.heroButtonContainer}>
                            <Button
                                variant="contained"
                                sx={[LandingPageStyles.getStartedButton, LandingPageStyles.heroButtons]}
                                onClick={handleLogin}
                            >
                                get started
                            </Button>
                            <Button
                                sx={[LandingPageStyles.heroButtons, { marginTop: '10px' }]}
                                color="secondary"
                                endIcon={<OpenInNew />}
                                target="_blank"
                                rel="noreferrer"
                                href="https://neurostuff.github.io/compose-docs/"
                            >
                                Learn More
                            </Button>
                        </Box>
                        <Box sx={LandingPageStyles.citationContainer}>
                            <Typography variant="body2" sx={LandingPageStyles.citationText}>
                                {NEUROSYNTH_COMPOSE_APA_CITATION}
                            </Typography>
                            <Tooltip title="Copy APA citation">
                                <IconButton
                                    aria-label="Copy Neurosynth Compose APA citation"
                                    onClick={handleCopyCitation}
                                    sx={LandingPageStyles.copyCitationButton}
                                >
                                    <ContentCopyIcon />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    </Box>
                    <Box sx={LandingPageStyles.imageContainer}>
                        <Box
                            component="img"
                            sx={LandingPageStyles.img}
                            src="/static/brain-analysis.png"
                            alt="brain-analysis"
                        />
                    </Box>
                </Box>
            </Box>
            <Box
                sx={[
                    LandingPageStyles.sectionContainer,
                    { backgroundColor: 'primary.contrastText', overflow: 'visible !important' },
                ]}
            >
                <Box sx={LandingPageStyles.sectionContents}>
                    <Box sx={LandingPageStyles.cardsContainer}>
                        <Card elevation={0} sx={LandingPageStyles.card}>
                            <CardContent>
                                <SearchIcon sx={LandingPageStyles.cardIcon} />
                                <Typography variant="h5" sx={LandingPageStyles.cardTitle}>
                                    Find Studies
                                </Typography>
                                <Typography variant="h6">
                                    Search across thousands of indexed neuroimaging studies, or import custom studies
                                    from PubMed and other sources
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card elevation={0} sx={LandingPageStyles.card}>
                            <CardContent>
                                <AutoAwesomeMotionIcon sx={LandingPageStyles.cardIcon} />
                                <Typography variant="h5" sx={LandingPageStyles.cardTitle}>
                                    Curate collections
                                </Typography>
                                <Typography variant="h6">
                                    Systematically select relevant studies, and track exclusion criteria using a
                                    PRISMA-compliant workflow
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card elevation={0} sx={LandingPageStyles.card}>
                            <CardContent>
                                <SettingsIcon sx={LandingPageStyles.cardIcon} />
                                <Typography variant="h5" sx={LandingPageStyles.cardTitle}>
                                    Specify & Execute Meta-analysis
                                </Typography>
                                <Typography variant="h6">
                                    Choose from dozens of meta-analysis algorithms, and execute either locally or in the
                                    cloud
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card elevation={0} sx={LandingPageStyles.card}>
                            <CardContent>
                                <IosShareIcon sx={LandingPageStyles.cardIcon} />
                                <Typography variant="h5" sx={LandingPageStyles.cardTitle}>
                                    Share your results!
                                </Typography>
                                <Typography variant="h6">
                                    Automatically upload results to NeuroVault for easy sharing and complete analysis
                                    provenance. Geneate comprehensive reports to facilitate interpretation
                                </Typography>
                            </CardContent>
                        </Card>
                    </Box>
                </Box>
            </Box>
            <Box sx={[LandingPageStyles.sectionContainer, { backgroundColor: 'secondary.main' }]}>
                <Box sx={LandingPageStyles.sectionContents}>
                    <Typography
                        variant="h3"
                        color="primary.main"
                        sx={{
                            marginBottom: '2rem',
                            color: 'secondary.contrastText',
                            textAlign: {
                                xs: 'center',
                                lg: 'left',
                            },
                        }}
                    >
                        Platform Comparison
                    </Typography>

                    <PlatformComparisonTable />
                </Box>
            </Box>
            <Box sx={{ width: '100%', backgroundColor: 'lightgray' }}>
                <Box
                    sx={{
                        width: '80%',
                        margin: '0 auto',
                    }}
                >
                    <Typography variant="h5" sx={{ padding: '3rem 0', textAlign: { xs: 'center', sm: 'left' } }}>
                        Neurosynth compose is supported by the following organizations:
                    </Typography>

                    <Box sx={{ width: '100%' }}>
                        <Box sx={LandingPageStyles.sponsorsImgContainer}>
                            {LOGOS.map((logo) => (
                                <Box key={logo.logoPath} sx={LandingPageStyles.sponsorLogoContainer}>
                                    <Box
                                        component="img"
                                        sx={LandingPageStyles.sponsorLogo}
                                        src={logo.logoPath}
                                        alt={logo.alt}
                                    />
                                </Box>
                            ))}
                        </Box>
                        <Typography
                            sx={{
                                padding: '2rem 0 4rem 0',
                                textAlign: { sx: 'center', lg: 'left' },
                            }}
                        >
                            Supported by NIH award 5R01MH096906-06
                        </Typography>
                    </Box>
                </Box>
            </Box>
        </>
    );
};

export default LandingPage;

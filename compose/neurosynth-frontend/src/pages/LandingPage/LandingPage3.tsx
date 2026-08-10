import { useAuth0 } from '@auth0/auth0-react';
import {
    AccountTree,
    AutoAwesomeMotion,
    IosShare,
    KeyboardArrowDown,
    OpenInNew,
    Psychology,
    Science,
    Search,
    Settings,
} from '@mui/icons-material';
import { Box, Button, Card, CardContent, Autocomplete, InputAdornment, TextField, Typography } from '@mui/material';
import NeurosynthActivitySummary from 'components/NeurosynthActivitySummary';
import NavToolbarPopupSubMenu from 'components/Navbar/NavToolbarPopupSubMenu';
import { NEUROSYNTH_COMPOSE_CITATION } from 'hooks/useCitationCopy.consts';
import { useCitationCopy } from 'hooks/useCitationCopy';
import useAuthenticate from 'hooks/useAuthenticate';
import LandingExploreCarousel from 'pages/LandingPage/components/LandingExploreCarousel';
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePrerenderReady, usePageMetadata } from '../../../seo/hooks';
import PlatformComparisonTable from 'pages/LandingPage/components/PlatformComparisonTable';
import { LOGOS } from 'pages/LandingPage/LandingPage.helpers';
import { MOCK_ONVOC_TERMS } from 'pages/Explore/Explore.mockData';
import LandingPage3Styles from './LandingPage3.styles';

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
                identifier: NEUROSYNTH_COMPOSE_CITATION.doiUrl,
            },
        },
    ],
});

/**
 * Wireframe iteration: classic left/right hero with explore search + map carousel.
 * View at /landing-3. Does not replace the primary landing page.
 */
const LandingPage3 = () => {
    const { isAuthenticated } = useAuth0();
    const { handleLogin } = useAuthenticate();
    const { copyCitations } = useCitationCopy();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');

    usePageMetadata({
        title: 'Landing v3 | Neurosynth Compose',
        description:
            'Create, curate, and run neuroimaging meta-analyses in the browser. Build studysets from published fMRI literature and execute reproducible pipelines in the cloud.',
        canonicalPath: '/landing-3',
    });
    usePrerenderReady(true);

    const handleSearchSubmit = (event: FormEvent) => {
        event.preventDefault();
        const trimmedQuery = searchQuery.trim();
        if (trimmedQuery) {
            navigate(`/explore?q=${encodeURIComponent(trimmedQuery)}`);
        } else {
            navigate('/explore');
        }
    };

    const handleNewMetaAnalysis = () => {
        if (isAuthenticated) {
            navigate('/projects');
        } else {
            handleLogin();
        }
    };

    return (
        <>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: SEO_GRAPH_DATA }} />
            <Box sx={LandingPage3Styles.heroSection}>
                <Box sx={LandingPage3Styles.heroBannerContentContainer}>
                    <Box sx={LandingPage3Styles.heroBannerTextContainer}>
                        <Typography component="h1" sx={LandingPage3Styles.title}>
                            Welcome to neurosynth Compose: A free and open platform for neuroimaging meta-analysis
                        </Typography>
                        <Typography sx={LandingPage3Styles.heroBannerText}>
                            Explore meta-analyses, or perform custom neuroimaging meta-analyses entirely in the browser,
                            and quickly get results in the cloud using automated analysis pipelines.
                        </Typography>
                        <Box sx={LandingPage3Styles.activitySummaryContainer}>
                            <NeurosynthActivitySummary />
                        </Box>
                        <Box component="form" onSubmit={handleSearchSubmit} sx={LandingPage3Styles.searchForm}>
                            <Autocomplete
                                freeSolo
                                options={MOCK_ONVOC_TERMS}
                                inputValue={searchQuery}
                                onInputChange={(_event, value) => setSearchQuery(value)}
                                onChange={(_event, value) => {
                                    const selectedTerm = typeof value === 'string' ? value : (value ?? '');
                                    setSearchQuery(selectedTerm);
                                    if (selectedTerm.trim()) {
                                        navigate(`/explore?q=${encodeURIComponent(selectedTerm.trim())}`);
                                    }
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        fullWidth
                                        placeholder="Search for brain maps, tasks, or terms…"
                                        inputProps={{
                                            ...params.inputProps,
                                            'aria-label': 'Search brain maps',
                                        }}
                                        InputProps={{
                                            ...params.InputProps,
                                            startAdornment: (
                                                <>
                                                    <InputAdornment position="start">
                                                        <Search sx={{ color: 'primary.main' }} />
                                                    </InputAdornment>
                                                    {params.InputProps.startAdornment}
                                                </>
                                            ),
                                        }}
                                        sx={LandingPage3Styles.searchField}
                                    />
                                )}
                            />
                        </Box>
                        <Box sx={LandingPage3Styles.actionButtons}>
                            <Button
                                variant="outlined"
                                startIcon={<AccountTree />}
                                onClick={() => navigate('/explore?focus=onvoc')}
                                sx={LandingPage3Styles.actionButtonOutlined}
                            >
                                Explore Terms
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<Psychology />}
                                onClick={() => navigate('/decode')}
                                sx={LandingPage3Styles.actionButtonOutlined}
                            >
                                Decode
                            </Button>
                            <Button
                                variant="contained"
                                startIcon={<Science />}
                                onClick={handleNewMetaAnalysis}
                                sx={LandingPage3Styles.actionButtonPrimary}
                            >
                                New meta-analysis
                            </Button>
                        </Box>
                    </Box>
                    <Box sx={LandingPage3Styles.carouselPanel}>
                        <Box sx={LandingPage3Styles.carouselInner}>
                            <LandingExploreCarousel variant="fillWidth" />
                        </Box>
                    </Box>
                </Box>
            </Box>
            <Box sx={[LandingPage3Styles.sectionContainer, { backgroundColor: 'primary.dark' }]}>
                <Box sx={LandingPage3Styles.sectionContents}>
                    <Card
                        elevation={0}
                        sx={{
                            px: { xs: 2, md: 4 },
                            py: 3,
                            borderRadius: 2,
                            backgroundColor: 'rgba(255, 255, 255, 0.06)',
                            border: '1px solid rgba(255, 255, 255, 0.12)',
                        }}
                    >
                        <Typography
                            variant="overline"
                            sx={{
                                color: 'primary.contrastText',
                                fontSize: '1rem',
                                letterSpacing: 1.5,
                            }}
                        >
                            Featured in Imaging Neuroscience
                        </Typography>
                        <Typography
                            variant="h5"
                            color="primary.contrastText"
                            sx={{
                                mb: 2,
                                fontWeight: 'bold',
                            }}
                        >
                            Read our recent publication on flexible and reproducible neuroimaging meta-analysis
                        </Typography>
                        <Box
                            sx={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 1.5,
                                alignItems: 'center',
                            }}
                        >
                            <Button
                                variant="contained"
                                sx={[LandingPage3Styles.getStartedButton, { color: 'primary.dark' }]}
                                endIcon={<OpenInNew sx={{ color: 'primary.dark' }} />}
                                target="_blank"
                                size="large"
                                rel="noreferrer"
                                href={NEUROSYNTH_COMPOSE_CITATION.doiUrl}
                            >
                                Go to publication
                            </Button>
                            <NavToolbarPopupSubMenu
                                buttonProps={{
                                    variant: 'outlined',
                                    size: 'large',
                                    endIcon: <KeyboardArrowDown />,
                                    sx: {
                                        color: 'primary.contrastText',
                                        borderColor: 'primary.contrastText',
                                        '&:hover': {
                                            borderColor: 'primary.contrastText',
                                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                        },
                                    },
                                }}
                                options={[
                                    { label: 'APA format', onClick: () => copyCitations('apa') },
                                    { label: 'Vancouver format', onClick: () => copyCitations('vancouver') },
                                    { label: 'Harvard format', onClick: () => copyCitations('harvard1') },
                                    { label: 'BibTeX format', onClick: () => copyCitations('bibtex') },
                                ]}
                                compactOptions
                                buttonLabel="Cite Me"
                            />
                        </Box>
                    </Card>
                </Box>
            </Box>
            <Box
                sx={[
                    LandingPage3Styles.sectionContainer,
                    { backgroundColor: 'primary.contrastText', overflow: 'visible !important' },
                ]}
            >
                <Box sx={LandingPage3Styles.sectionContents}>
                    <Box sx={LandingPage3Styles.cardsContainer}>
                        <Card elevation={0} sx={LandingPage3Styles.card}>
                            <CardContent>
                                <Search sx={LandingPage3Styles.cardIcon} />
                                <Typography variant="h5" sx={LandingPage3Styles.cardTitle}>
                                    Find Studies
                                </Typography>
                                <Typography variant="h6">
                                    Search across thousands of indexed neuroimaging studies, or import custom studies
                                    from PubMed and other sources
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card elevation={0} sx={LandingPage3Styles.card}>
                            <CardContent>
                                <AutoAwesomeMotion sx={LandingPage3Styles.cardIcon} />
                                <Typography variant="h5" sx={LandingPage3Styles.cardTitle}>
                                    Curate collections
                                </Typography>
                                <Typography variant="h6">
                                    Systematically select relevant studies, and track exclusion criteria using a
                                    PRISMA-compliant workflow
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card elevation={0} sx={LandingPage3Styles.card}>
                            <CardContent>
                                <Settings sx={LandingPage3Styles.cardIcon} />
                                <Typography variant="h5" sx={LandingPage3Styles.cardTitle}>
                                    Specify & Execute Meta-analysis
                                </Typography>
                                <Typography variant="h6">
                                    Choose from dozens of meta-analysis algorithms, and execute either locally or in the
                                    cloud
                                </Typography>
                            </CardContent>
                        </Card>
                        <Card elevation={0} sx={LandingPage3Styles.card}>
                            <CardContent>
                                <IosShare sx={LandingPage3Styles.cardIcon} />
                                <Typography variant="h5" sx={LandingPage3Styles.cardTitle}>
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
            <Box sx={[LandingPage3Styles.sectionContainer, { backgroundColor: 'secondary.main' }]}>
                <Box sx={LandingPage3Styles.sectionContents}>
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
                        <Box sx={LandingPage3Styles.sponsorsImgContainer}>
                            {LOGOS.map((logo) => (
                                <Box key={logo.logoPath} sx={LandingPage3Styles.sponsorLogoContainer}>
                                    <Box
                                        component="img"
                                        sx={LandingPage3Styles.sponsorLogo}
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

export default LandingPage3;

import { Style } from '../..';

const LandingPage3Styles: Style = {
    // stuff related to all page sections
    sectionContainer: {
        width: '100%',
        overflow: 'auto',
    },
    sectionContents: {
        width: '80%',
        margin: {
            xs: '2rem auto',
            md: '2rem auto',
            lg: '3rem auto',
            xl: '6rem auto',
        },
    },
    exploreHeroSection: {
        background: 'linear-gradient(180deg, #e8f4f8 0%, #ffffff 55%, #ffffff 100%)',
        minHeight: 'calc(100vh - 64px)',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'auto',
    },
    exploreHeroContents: {
        width: {
            xs: '92%',
            sm: '86%',
            md: 720,
        },
        maxWidth: 720,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 1.5,
        py: 2,
    },
    exploreHeroLogo: {
        width: 68,
        height: 68,
        mb: 1,
    },
    exploreHeroTitle: {
        color: 'primary.main',
        fontWeight: 800,
        fontSize: { xs: '2rem', md: '2.65rem' },
        lineHeight: 1.15,
        letterSpacing: '-0.02em',
    },
    exploreHeroSubtitle: {
        color: 'text.secondary',
        maxWidth: 520,
        fontSize: { xs: '1.05rem', md: '1.2rem' },
        lineHeight: 1.6,
        fontWeight: 400,
        mb: 1.5,
    },
    exploreSearchForm: {
        width: '100%',
        mt: 1,
    },
    exploreSearchField: {
        backgroundColor: 'background.paper',
        borderRadius: 2,
        '& .MuiOutlinedInput-root': {
            borderRadius: 2,
            fontSize: '1.05rem',
            py: 0.5,
        },
    },
    exploreActionButtons: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1.5,
        justifyContent: 'center',
        width: '100%',
        mb: 5,
    },
    exploreActionButton: {
        textTransform: 'none',
        fontWeight: 600,
        borderColor: 'primary.main',
        color: 'primary.main',
        px: 2,
    },
    exploreActionButtonPrimary: {
        textTransform: 'none',
        fontWeight: 600,
        px: 2,
    },
    getStartedButton: {
        backgroundColor: 'white',
        color: 'primary.main',
        '&:hover': {
            backgroundColor: 'lightgray',
        },
    },
    // stuff related to card section
    cardsContainer: {
        width: '100%',
        display: 'flex',
        flexDirection: {
            xs: 'column',
            md: 'row',
        },
    },
    card: {
        width: '100%',
        textAlign: 'center',
        color: 'primary.main',
    },
    cardIcon: {
        marginBottom: '1rem',
        color: 'primary.main',
        fontSize: '4rem',
    },
    cardTitle: {
        fontWeight: 'bold',
        wordBreak: 'break-word',
        marginBottom: '1rem',
        textAlign: 'center',
    },
    // stuff related to bottom section logos
    logo: {
        width: '100px',
        height: '100px',
    },
    sponsorsImgContainer: {
        display: 'flex',
        justifyContent: { xs: 'center', lg: 'flex-start' },
        width: '100%',
        flexWrap: 'wrap',
    },
    sponsorLogoContainer: {
        width: {
            xs: '42%',
            lg: '21%',
        },
        padding: {
            xs: '4%',
            lg: '2%',
        },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    sponsorLogo: {
        width: {
            xs: '160px',
            md: '200px',
        },
        display: 'block',
    },
};

export default LandingPage3Styles;

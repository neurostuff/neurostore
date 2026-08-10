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
    heroSection: {
        width: '100%',
        minHeight: 'calc(100vh - 64px)',
        height: {
            xs: 'auto',
            lg: 'calc(100vh - 64px)',
        },
        boxSizing: 'border-box',
        backgroundColor: 'primary.main',
        display: 'flex',
        alignItems: 'stretch',
        overflow: { xs: 'auto', lg: 'hidden' },
    },
    heroBannerContentContainer: {
        display: 'flex',
        width: '100%',
        minHeight: '100%',
        alignItems: 'stretch',
        justifyContent: 'space-between',
        gap: {
            xs: 0,
            lg: 6,
        },
        flexDirection: {
            xs: 'column',
            lg: 'row',
        },
    },
    title: {
        color: 'primary.contrastText',
        fontWeight: 800,
        fontSize: {
            xs: '1.45rem',
            md: '1.75rem',
            xl: '1.95rem',
        },
        lineHeight: 1.25,
        letterSpacing: '-0.02em',
        textAlign: {
            xs: 'center',
            lg: 'left',
        },
        mb: 1.5,
    },
    heroBannerTextContainer: {
        flex: {
            xs: 'none',
            lg: '1 1 52%',
        },
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
        pl: {
            xs: '5vw',
            md: '10vw',
        },
        pr: {
            xs: 3.5,
            md: 6,
            lg: 8,
            xl: 10,
        },
        py: {
            xs: 5,
            lg: 8,
        },
        textAlign: {
            xs: 'center',
            lg: 'left',
        },
        order: { xs: 1, lg: 1 },
    },
    heroBannerText: {
        color: 'rgba(255, 255, 255, 0.92)',
        fontSize: {
            xs: '0.95rem',
            md: '1.05rem',
        },
        lineHeight: 1.6,
        fontWeight: 400,
        mx: { xs: 'auto', lg: 0 },
        mb: 2.5,
    },
    activitySummaryContainer: {
        marginBottom: '1.75rem',
        display: 'flex',
        justifyContent: { xs: 'center', lg: 'flex-start' },
    },
    searchForm: {
        width: '100%',
        mx: { xs: 'auto', lg: 0 },
        mb: 2,
    },
    searchField: {
        backgroundColor: 'common.white',
        borderRadius: 1.5,
        boxShadow: '0 10px 30px rgba(0, 40, 70, 0.18)',
        '& .MuiOutlinedInput-root': {
            borderRadius: 1.5,
            fontSize: '1.05rem',
            backgroundColor: 'common.white',
            '& fieldset': { borderColor: 'transparent' },
            '&:hover fieldset': { borderColor: 'transparent' },
            '&.Mui-focused fieldset': { borderColor: 'rgba(255,255,255,0.55)' },
        },
    },
    actionButtons: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 1.25,
        justifyContent: { xs: 'center', lg: 'flex-start' },
        width: '100%',
        maxWidth: 520,
        mx: { xs: 'auto', lg: 0 },
    },
    actionButtonOutlined: {
        textTransform: 'none',
        fontWeight: 600,
        px: 2,
        borderRadius: 2.5,
        color: 'common.white',
        borderColor: 'rgba(255, 255, 255, 0.65)',
        '&:hover': {
            borderColor: 'common.white',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
        },
    },
    actionButtonPrimary: {
        textTransform: 'none',
        fontWeight: 700,
        px: 2.25,
        borderRadius: 2.5,
        backgroundColor: 'common.white',
        color: 'primary.main',
        boxShadow: '0 8px 22px rgba(0, 40, 70, 0.2)',
        '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.92)',
            boxShadow: '0 10px 28px rgba(0, 40, 70, 0.28)',
        },
    },
    getStartedButton: {
        backgroundColor: 'white',
        color: 'primary.main',
        '&:hover': {
            backgroundColor: 'lightgray',
        },
    },
    carouselPanel: {
        flex: {
            xs: 'none',
            lg: '0 0 48%',
        },
        maxWidth: { lg: 640 },
        alignSelf: { lg: 'center' },
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000000',
        borderTopLeftRadius: {
            xs: 0,
            lg: '220px',
        },
        borderBottomLeftRadius: {
            xs: 0,
            lg: '220px',
        },
        borderBottomRightRadius: { lg: 0 },
        borderTopRightRadius: { lg: 0 },
        pl: { xs: 2.5, md: 4, lg: 7 },
        pr: { xs: 2.5, md: 3.5, lg: 4 },
        py: { xs: 3, lg: 3 },
        my: { lg: 4.5 },
        minHeight: { lg: 'min(480px, calc(100vh - 64px - 72px))' },
        maxHeight: { lg: 'min(480px, calc(100vh - 64px - 72px))' },
        order: { xs: 2, lg: 2 },
        boxShadow: 'none',
    },
    carouselInner: {
        width: '84%',
        mx: 'auto',
        '& .MuiTypography-root': {
            color: 'common.white',
            fontSize: '1.35rem',
            fontWeight: 500,
        },
        '& a': {
            color: 'common.white !important',
            fontWeight: 700,
            fontSize: '1.35rem',
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

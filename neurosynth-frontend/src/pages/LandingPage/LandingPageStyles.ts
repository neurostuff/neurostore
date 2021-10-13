import { Style } from '../..';

const LandingPageStyles: Style = {
    contentContainer: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
    },
    titleContainer: {
        display: 'flex',
        flexDirection: {
            xs: 'column',
            md: 'row',
        },
        alignItems: 'center',
        justifyContent: 'space-between',
        fontFamily: 'Inter',
        width: {
            xs: '100%',
            md: '650px',
        },
    },
    title: {
        fontSize: {
            xs: '2rem',
            md: '3rem',
        },
        marginTop: {
            xs: '6%',
            md: 0,
        },
    },
    logo: {
        width: '100px',
    },
    sponsorContainer: {
        width: '100%',
    },
    sponsorsImgContainer: {
        display: 'flex',
        justifyContent: 'space-around',
        width: '100%',
        flexWrap: 'wrap',
        alignItems: {
            xs: 'center',
            md: 'normal',
        },
    },
    sponsorLogoContainer: {
        margin: {
            xs: '10% 5%',
            md: 'auto 5%',
        },
    },
    sponsorLogo: {
        width: {
            xs: '100px',
            md: '125px',
        },
    },
    nihAwardText: {
        textAlign: 'center',
        margin: '2% 0',
    },
    descriptor: {
        fontSize: {
            xs: '1rem',
            md: '1.5rem',
        },
        margin: {
            xs: '6% 0',
            md: '2% 0 0 0',
        },
        width: {
            xs: '100%',
            md: '650px',
        },
        fontFamily: 'Roboto',
        color: 'muted.main',
        lineHeight: '2',
        textAlign: 'center',
    },
    divider: {
        margin: '2% 0 !important',
        width: '100%',
    },
};

export default LandingPageStyles;

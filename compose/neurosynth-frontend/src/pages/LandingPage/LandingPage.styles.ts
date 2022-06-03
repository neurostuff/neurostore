import { Style } from '../..';

const LandingPageStyles: Style = {
    sectionContainer: {
        width: '80%',
        margin: '0 auto',
        padding: {
            xs: '3rem 0 4rem 0',
            md: '6rem 0 8rem 0',
        },
    },
    // stuff related to first intro section
    title: {
        color: 'primary.contrastText',
        fontWeight: 'bold',
    },
    introSpacedText: {
        color: 'primary.contrastText',
        padding: {
            xs: '1rem 0',
            md: '2rem 0',
        },
    },
    introDetailsContainer: {
        display: 'flex',
        flexDirection: {
            xs: 'column',
            md: 'column',
            lg: 'row',
        },
        width: '100%',
        justifyContent: 'space-between',
    },
    // stuff related to workflow section
    workflowContainer: {
        display: 'flex',
        flexDirection: {
            xs: 'column-reverse',
            md: 'row',
        },
    },
    stepperContainer: {
        width: {
            xs: '100%',
            md: '50%',
        },
        margin: {
            xs: '0',
            md: '2rem 0',
        },
    },
    glossaryContainer: {
        width: {
            xs: '100%',
            md: '50%',
        },
    },
    glossary: {
        position: {
            xs: 'relative',
            md: 'sticky',
        },
        width: '100%',
        top: 0,
    },
    // stuff related to bottom section logos
    logo: {
        width: '100px',
        height: '100px',
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
            xs: '20px 10px',
            md: 'auto 5%',
        },
    },
    sponsorLogo: {
        width: {
            xs: '100px',
            md: '125px',
        },
    },
};

export default LandingPageStyles;

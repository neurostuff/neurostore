import { Style } from '../..';

const LandingPageStyles: Style = {
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
    // stuff related to first intro section
    introContentContainer: {
        display: 'flex',
        width: '100%',
        justifyContent: 'space-between',
        flexDirection: {
            xs: 'column-reverse',
            md: 'column-reverse',
            lg: 'row',
        },
    },
    title: {
        color: 'primary.contrastText',
        fontWeight: 'bold',
    },
    introSpacedText: {
        color: 'primary.contrastText',
        padding: {
            xs: '0.5rem 0',
            md: '1rem 0',
        },
    },
    imageContainer: {
        borderTopLeftRadius: {
            xs: '0px',
            md: '0px',
            lg: '400px',
        },
        borderBottomLeftRadius: {
            xs: '0px',
            md: '0px',
            lg: '400px',
        },
        display: 'flex',
        backgroundColor: 'white',
        alignItems: 'center',
        justifyContent: 'center',
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

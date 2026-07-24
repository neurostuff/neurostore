import { Style } from '../..';

const LandingPageStyles: Style = {
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
    // stuff related to first intro section
    heroBannerContentContainer: {
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
        textAlign: {
            xs: 'center',
            lg: 'left',
        },
    },
    heroBannerTextContainer: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
        padding: {
            xs: '2rem',
            md: '2rem 2rem 2rem 0rem',
            lg: '2rem 2rem 2rem 0rem',
            xl: '3rem 6rem 3rem 0rem',
        },
        marginLeft: '10%',
        textAlign: {
            xs: 'center',
            lg: 'left',
        },
    },
    heroBannerText: {
        color: 'primary.contrastText',
        lineHeight: '1.7',
        padding: {
            xs: '0.5rem 0',
            md: '1rem 0',
        },
    },
    heroButtonContainer: {
        display: 'flex',
        flexDirection: {
            xs: 'column',
            md: 'row',
        },
    },
    heroButtons: {
        fontWeight: 'bold',
        fontSize: '1.2rem',
        width: {
            xs: '100%',
            lg: '40%',
        },
    },
    getStartedButton: {
        backgroundColor: 'white',
        color: 'primary.main',
        '&:hover': {
            backgroundColor: 'lightgray',
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
    img: {
        padding: '0 4rem',
        height: 'auto',
        width: {
            xs: '300px',
            md: '500px', // we shift orientation here so we can make the image bigger
            lg: '400px', // image becomes right aligned
            xl: '600px',
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

export default LandingPageStyles;

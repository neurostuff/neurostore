import { NAVBAR_HEIGHT } from 'components/Navbar/Navbar';
import { Style } from '../..';

const curationPageMargin = 1;

const BaseNavigationStyles: Style = {
    pagesContainer: {
        width: {
            xs: '90%',
            md: '80%',
        },
        margin: '2% auto',
    },
    curationPageContainer: {
        marginTop: `${curationPageMargin}rem`,
        marginBottom: `${curationPageMargin}rem`,
        marginLeft: `${curationPageMargin}rem`,
        display: 'flex',
        flexDirection: 'column',
        height: `calc(100vh - ${NAVBAR_HEIGHT}px - ${curationPageMargin * 2}rem)`,
    },
};

export default BaseNavigationStyles;

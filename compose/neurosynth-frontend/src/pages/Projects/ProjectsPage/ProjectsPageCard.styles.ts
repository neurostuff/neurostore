import { Style } from 'index';

const ProjectsPageCardStyles: Style = {
    card: {
        transition: '500ms',
        backgroundColor: 'white',
        borderLeft: '0px solid transparent',
        '&:hover': {
            backgroundColor: '#f3f3f3',
            borderLeft: '5px solid #0077b6',
            transition: '500ms',
            cursor: 'pointer',
        },
    },
};

export default ProjectsPageCardStyles;

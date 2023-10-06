import SearchIcon from '@mui/icons-material/Search';
import AutoAwesomeMotionIcon from '@mui/icons-material/AutoAwesomeMotion';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

export const LOGOS: { logoPath: string; alt: string }[] = [
    {
        logoPath: '/static/utlogo.png',
        alt: 'UT Logo',
    },
    {
        logoPath: '/static/mcgilllogo.png',
        alt: 'McGill Logo',
    },
    {
        logoPath: '/static/nihlogo.png',
        alt: 'NIH Logo',
    },
    {
        logoPath: '/static/fiulogo.png',
        alt: 'FIU Logo',
    },
    {
        logoPath: '/static/oxfordlogo.png',
        alt: 'Oxford Logo',
    },
    {
        logoPath: '/static/stanfordlogo.png',
        alt: 'Stanford Logo',
    },
    {
        logoPath: '/static/origamilogo.png',
        alt: 'Origami Labs Logo',
    },
];

export const STEPS = [
    {
        icon: <SearchIcon color="primary" />,
        title: '(1) Search Studies',
        textContent:
            'Search titles and abstracts of all articles included in neurosynth, neuroquery, and more.',
    },
    {
        icon: <AutoAwesomeMotionIcon color="primary" />,
        title: '(2) Create Studyset',
        textContent: 'Create a collection of studies that meet your search criteria.',
    },
    {
        icon: <FilterAltIcon color="primary" />,
        title: '(3) Annotate Studyset',
        textContent:
            'Annotate each analysis within your study-set with experimental details and inclusion criteria.',
    },
    {
        icon: <SettingsIcon color="primary" />,
        title: '(4) Specify Meta-Analysis',
        textContent:
            'Specify which meta-analytic algorithm and its parameters to apply to your study-set through NiMARE.',
    },
    {
        icon: <CheckCircleIcon color="primary" />,
        title: '(5) Execute Meta-Analysis',
        textContent:
            'Execute the prepared meta-analysis online or on your machine. NiMARE is the primary execution engine downloading the study-set, annotation, and meta-analysis specification for reproducible analysis.',
    },
];

import { Link, LinkProps } from '@mui/material';
import DisplayLinkStyles from './DisplayLink.styles';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

const DisplayLink: React.FC<{ label: string } & LinkProps> = ({ label, ...linkProps }) => {
    return (
        <Link
            color="primary"
            target="_blank"
            rel="noreferrer"
            underline="hover"
            {...linkProps}
            sx={{ ...DisplayLinkStyles.link, ...(linkProps?.sx || {}) }}
        >
            {label}
            <OpenInNewIcon sx={DisplayLinkStyles.linkIcon} fontSize="small" />
        </Link>
    );
};

export default DisplayLink;

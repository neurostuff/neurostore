import { Link, LinkProps } from '@mui/material';
import DisplayLinkStyles from './DisplayLink.styles';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

const DisplayLink = ({  label, ...linkProps  }: { label: string } & LinkProps) => {
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

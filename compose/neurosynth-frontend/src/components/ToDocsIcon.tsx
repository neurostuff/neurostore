import { HelpOutline } from '@mui/icons-material';
import { IconButton, IconButtonOwnProps } from '@mui/material';

const DOCS_PREFIX = 'https://neurostuff.github.io/compose-docs/';

const ToDocsIcon: React.FC<IconButtonOwnProps & { url: string }> = ({ url, ...props }) => {
    return (
        <IconButton {...props} size="small" target="_blank" href={`${DOCS_PREFIX}${url}`}>
            <HelpOutline sx={{ height: '0.8em', width: '0.8em' }} />
        </IconButton>
    );
};

export default ToDocsIcon;

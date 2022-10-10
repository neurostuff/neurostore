import { Button, ListItem, ListItemButton, ListItemIcon, ListItemText } from '@mui/material';
import { IPubmedArticle } from 'hooks/requests/useGetPubmedIDs';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

interface IPubmedWizardStudyListItem {
    included: boolean | undefined;
    selected: boolean;
    pubmedArticle: IPubmedArticle;
    onSelect: (index: number) => void;
    index: number;
}

const PubmedWizardStudyListItem: React.FC<IPubmedWizardStudyListItem> = (props) => {
    let icon = undefined;
    let color = 'gray';

    if (props.included) {
        color = 'success.main';
        icon = <CheckCircleIcon sx={{ color }} />;
    } else if (props.included === false) {
        color = 'error.main';
        icon = <CancelIcon sx={{ color }} />;
    }

    return (
        <ListItem
            disablePadding
            selected={props.selected}
            sx={{ width: '100%', whiteSpace: 'break-spaces' }}
        >
            <ListItemButton autoFocus={props.selected} onClick={() => props.onSelect(props.index)}>
                <ListItemIcon>{icon}</ListItemIcon>
                <ListItemText
                    sx={{ color }}
                    primary={props.pubmedArticle?.title || ''}
                ></ListItemText>
            </ListItemButton>
        </ListItem>
    );
};

export default PubmedWizardStudyListItem;

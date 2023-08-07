import {
    Box,
    Chip,
    IconButton,
    List,
    ListItem,
    ListItemButton,
    ListItemText,
    ListSubheader,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CurationStepGroupsStyles from './CurationStepGroups.styles';

const CurationGroupListItems: React.FC = (props) => {
    return (
        <Box>
            <List disablePadding>
                <ListItem sx={CurationStepGroupsStyles.listItem} disablePadding>
                    <ListItemButton sx={CurationStepGroupsStyles.listItemButton} selected={true}>
                        <ListItemText primary="Uncategorized"></ListItemText>
                        <Chip color="warning" label="47" />
                    </ListItemButton>
                </ListItem>
                <ListItem sx={CurationStepGroupsStyles.listItem} disablePadding>
                    <ListItemButton sx={CurationStepGroupsStyles.listItemButton} selected={false}>
                        <ListItemText primary="Needs Review"></ListItemText>
                        <Chip color="warning" label="2" />
                    </ListItemButton>
                </ListItem>
                <ListSubheader sx={{ backgroundColor: 'rgb(242, 242, 242)' }}>
                    Exclusion Reasons
                </ListSubheader>
                <ListItem sx={CurationStepGroupsStyles.listItem} disablePadding>
                    <ListItemButton sx={CurationStepGroupsStyles.listItemButton} selected={false}>
                        <ListItemText primary="Duplicates"></ListItemText>
                        <Chip label="3" />
                    </ListItemButton>
                </ListItem>
                <ListSubheader sx={{ backgroundColor: 'rgb(242, 242, 242)' }}>
                    Imports
                </ListSubheader>
                <ListItem sx={CurationStepGroupsStyles.listItem} disablePadding>
                    <ListItemButton sx={CurationStepGroupsStyles.listItemButton} selected={false}>
                        <ListItemText primary="WoS Import"></ListItemText>
                        <Chip label="43" />
                        <IconButton>
                            <DeleteIcon sx={{ color: 'error.main' }} />
                        </IconButton>
                    </ListItemButton>
                </ListItem>
                <ListItem sx={CurationStepGroupsStyles.listItem} disablePadding>
                    <ListItemButton sx={CurationStepGroupsStyles.listItemButton} selected={false}>
                        <ListItemText primary="RIS Import"></ListItemText>
                        <Chip label="21" />
                        <IconButton>
                            <DeleteIcon sx={{ color: 'error.main' }} />
                        </IconButton>
                    </ListItemButton>
                </ListItem>
            </List>
        </Box>
    );
};

export default CurationGroupListItems;

import { Box, Chip, List, ListItem, ListItemButton, ListItemText, ListSubheader } from '@mui/material';
import { ECurationBoardAIInterface } from './CurationBoardAi';
import CurationBoardAIGroupsStyles from './CurationBoardAIGroups.styles';

export enum ICurationGroupId {
    UNCATEGORIZED = 'uncategorized',
    NEEDS_REVIEW = 'needs_review',
    INCLUDED = 'included',
}

export interface IGroupListItem {
    type: 'LISTITEM' | 'SUBHEADER';
    id: string | ICurationGroupId;
    label: string;
    secondaryLabel?: string;
    count: number | null;
    UI: ECurationBoardAIInterface | null;
}

const CurationBoardAIGroupsList: React.FC<{
    selectedGroup: IGroupListItem | undefined;
    groups: IGroupListItem[];
    onSelectGroup: (selectedInterface: IGroupListItem) => void;
}> = ({ selectedGroup, onSelectGroup, groups }) => {
    const handleSelectGroup = (group: IGroupListItem) => {
        onSelectGroup(group);
    };

    return (
        <List
            disablePadding
            sx={{
                height: '100%',
                overflowY: 'auto',
                direction: 'rtl',
                scrollbarColor: '#c1c1c1 rgb(242, 242, 242)',
            }}
        >
            <Box sx={{ direction: 'ltr' }}>
                {groups.map((group) => {
                    return group.type === 'LISTITEM' ? (
                        <ListItem
                            key={group.id}
                            disablePadding
                            disableGutters
                            sx={CurationBoardAIGroupsStyles.listItem}
                        >
                            <ListItemButton
                                onClick={() => handleSelectGroup(group)}
                                sx={CurationBoardAIGroupsStyles.listItemButton}
                                selected={selectedGroup?.id === group.id}
                            >
                                <ListItemText
                                    sx={{
                                        '.MuiListItemText-primary': {
                                            fontSize: '14px',
                                            ...CurationBoardAIGroupsStyles.lineClamp3,
                                        },
                                    }}
                                    secondaryTypographyProps={{ fontSize: '11px', whiteSpace: 'pre' }}
                                    primary={group.label}
                                    secondary={group.secondaryLabel}
                                />
                                <Chip label={group.count} sx={{ fontSize: '12px', height: '20px' }} />
                            </ListItemButton>
                        </ListItem>
                    ) : (
                        <ListSubheader key={group.id} sx={CurationBoardAIGroupsStyles.listSubheader}>
                            {group.label}
                        </ListSubheader>
                    );
                })}
            </Box>
        </List>
    );
};

export default CurationBoardAIGroupsList;

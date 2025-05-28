import { KeyboardArrowRight } from '@mui/icons-material';
import { ListItem, ListItemButton, ListItemIcon, ListItemText, Chip, Collapse, Box } from '@mui/material';
import CurationBoardAIGroupsStyles from './CurationBoardAIGroups.styles';
import { IGroupListItem } from './CurationBoardAIGroupsList';
import { useState } from 'react';
import React from 'react';

const CurationBoardAIGroupsListItem: React.FC<{
    selectedGroupId: string | undefined;
    group: IGroupListItem;
    handleSelectGroup: (group: IGroupListItem) => void;
}> = ({ selectedGroupId, handleSelectGroup = () => {}, group }) => {
    const [expanded, setExpanded] = useState(false);

    const isExpandable = !!group.children?.length;

    return (
        <React.Fragment>
            <ListItem
                disablePadding
                disableGutters
                sx={{ ...CurationBoardAIGroupsStyles.listItem, ...(group.listItemStyles || {}) }}
            >
                <ListItemButton
                    onClick={() => {
                        if (isExpandable) {
                            setExpanded((prev) => !prev);
                        } else {
                            handleSelectGroup(group);
                        }
                    }}
                    sx={CurationBoardAIGroupsStyles.listItemButton}
                    selected={
                        selectedGroupId === group.id ||
                        (!expanded && group.children?.some((x) => x.id === selectedGroupId))
                    }
                >
                    {isExpandable && (
                        <ListItemIcon sx={{ width: '40px', minWidth: '0px', ...group.listItemStyles }}>
                            <KeyboardArrowRight
                                sx={{
                                    transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                    transition: 'transform 200ms ease-in-out',
                                }}
                            />
                        </ListItemIcon>
                    )}
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
                    {!expanded && <Chip label={group.count} sx={{ fontSize: '12px', height: '20px' }} />}
                </ListItemButton>
            </ListItem>
            {(group.children || []).length > 0 && (
                <Collapse in={expanded}>
                    <Box>
                        {(group.children || []).map((child) => (
                            <ListItem
                                key={child.id}
                                disablePadding
                                disableGutters
                                sx={{ ...CurationBoardAIGroupsStyles.listItem, ...(child.listItemStyles || {}) }}
                            >
                                <ListItemButton
                                    onClick={() => handleSelectGroup(child)}
                                    sx={CurationBoardAIGroupsStyles.listItemButton}
                                    selected={selectedGroupId === child.id}
                                >
                                    <ListItemText
                                        sx={{
                                            paddingLeft: '40px',
                                            '.MuiListItemText-primary': {
                                                fontSize: '14px',
                                                ...CurationBoardAIGroupsStyles.lineClamp3,
                                            },
                                        }}
                                        secondaryTypographyProps={{
                                            fontSize: '11px',
                                            whiteSpace: 'pre',
                                        }}
                                        primary={child.label}
                                        secondary={child.secondaryLabel}
                                    />
                                    <Chip label={child.count} sx={{ fontSize: '12px', height: '20px' }} />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </Box>
                </Collapse>
            )}
        </React.Fragment>
    );
};

export default CurationBoardAIGroupsListItem;

import { List, ListItem, ListItemIcon, ListItemText, Paper, Typography } from '@mui/material';
import type { ReactNode } from 'react';

export type MoveToExtractionDialogSectionItem = {
    icon: ReactNode;
    title: ReactNode;
    description: ReactNode;
};

function MoveToExtractionDialogSection({
    title,
    items,
}: {
    title: ReactNode;
    items: MoveToExtractionDialogSectionItem[];
}) {
    return (
        <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography sx={{ fontWeight: 'bold' }}>{title}</Typography>
            <List dense disablePadding>
                {items.map((item, index) => (
                    <ListItem key={index} alignItems="flex-start" divider={index < items.length - 1} disableGutters>
                        <ListItemIcon sx={{ minWidth: 40, mt: 0.5 }}>{item.icon}</ListItemIcon>
                        <ListItemText
                            primary={item.title}
                            secondary={item.description}
                            primaryTypographyProps={{ fontWeight: 'bold' }}
                        />
                    </ListItem>
                ))}
            </List>
        </Paper>
    );
}

export default MoveToExtractionDialogSection;

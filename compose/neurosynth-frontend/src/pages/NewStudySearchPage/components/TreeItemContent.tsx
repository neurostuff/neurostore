import { UseTreeItemContentSlotOwnProps } from '@mui/x-tree-view/useTreeItem/useTreeItem.types';
import { TreeItemContent as MuiTreeItemContent } from '@mui/x-tree-view';
import { IconButton } from '@mui/material';
import { Add } from '@mui/icons-material';
import React from 'react';

const TreeItemContent = React.forwardRef(function TreeItemContent(
    { children, ...props }: { children: React.ReactNode } & UseTreeItemContentSlotOwnProps,
    ref: React.Ref<HTMLDivElement>
) {
    return (
        <MuiTreeItemContent
            {...props}
            sx={{ fontSize: '12px !important', '.MuiTreeItem-label': { fontSize: '14px !important' } }}
            ref={ref}
        >
            {children}
            <IconButton size="small" onClick={(e) => e.stopPropagation()}>
                <Add sx={{ fontSize: '18px' }} />
            </IconButton>
        </MuiTreeItemContent>
    );
});

export default TreeItemContent;

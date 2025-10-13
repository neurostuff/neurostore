import React from 'react';
import { TreeItem as MuiTreeItem } from '@mui/x-tree-view';
import TreeItemContent from './TreeItemContent';
import { TreeItemProps } from '@mui/x-tree-view/TreeItem/TreeItem.types';

const TreeItem = React.forwardRef(function TreeItem(props: TreeItemProps, ref: React.Ref<HTMLLIElement>) {
    return (
        <MuiTreeItem
            {...props}
            sx={{
                ...props.sx,
                fontSize: '12px !important',
                direction: 'ltr',
            }}
            ref={ref}
            slots={{
                content: TreeItemContent,
            }}
        />
    );
});

export default TreeItem;

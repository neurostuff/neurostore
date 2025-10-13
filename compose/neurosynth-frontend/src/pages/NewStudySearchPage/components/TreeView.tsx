import { RichTreeView, TreeViewBaseItem } from '@mui/x-tree-view';
import { SyntheticEvent } from 'react';
import TreeItem from './TreeItem';

function TreeView({
    onSelectedItemsChange,
    items,
}: {
    onSelectedItemsChange: (event: SyntheticEvent<Element, Event> | null, itemId: string | null) => void;
    items: TreeViewBaseItem[];
}) {
    return (
        <RichTreeView
            items={items}
            slots={{
                item: TreeItem,
            }}
            selectedItems={null}
            onSelectedItemsChange={onSelectedItemsChange}
            multiSelect={false}
            slotProps={{
                item: {
                    sx: {
                        ul: {
                            maxHeight: '300px !important',
                            overflow: 'auto',
                            scrollbarColor: 'gray #fafafa',
                            direction: 'rtl',
                        },
                    },
                },
            }}
        />
    );
}

export default TreeView;

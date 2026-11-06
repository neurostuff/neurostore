import { ListSubheader, Menu, MenuItem } from '@mui/material';

/** The slots of one entity a span supports: `entity` is its id, `name` its name; each item's `label` names it with its entity. */
export interface SupportGroup {
    entity: string;
    name: string;
    items: { key: string; field: string; label: string }[];
}

export interface SupportChoice {
    groups: SupportGroup[];
    at: { top: number; left: number };
}

export function SupportMenu({
    choice,
    onChoose,
    onClose,
}: {
    choice: SupportChoice | null;
    onChoose: (key: string) => void;
    onClose: () => void;
}) {
    return (
        <Menu
            open={choice !== null}
            onClose={onClose}
            anchorReference="anchorPosition"
            anchorPosition={choice?.at}
            MenuListProps={{ 'aria-label': 'items this evidence supports', dense: true }}
            slotProps={{ paper: { sx: { maxHeight: '40vh' } } }}
        >
            {choice?.groups.flatMap(({ entity, name, items }) => [
                <ListSubheader key={entity} sx={{ lineHeight: 2.5 }}>
                    {name}
                </ListSubheader>,
                ...items.map((item) => (
                    <MenuItem key={item.key} aria-label={item.label} onClick={() => onChoose(item.key)}>
                        {item.field}
                    </MenuItem>
                )),
            ])}
        </Menu>
    );
}

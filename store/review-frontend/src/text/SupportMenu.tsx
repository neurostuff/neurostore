import { Menu, MenuItem } from '@mui/material';

export interface SupportChoice {
    items: { key: string; label: string }[];
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
            aria-label="items this evidence supports"
        >
            {choice?.items.map((item) => (
                <MenuItem key={item.key} onClick={() => onChoose(item.key)}>
                    {item.label}
                </MenuItem>
            ))}
        </Menu>
    );
}

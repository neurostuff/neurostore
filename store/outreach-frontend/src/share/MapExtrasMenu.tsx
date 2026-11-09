import { Divider, ListSubheader, MenuItem } from '@mui/material';
import { shownPath } from './review';
import type { ShareUpload } from './types';

/** The rest of a map's menu, under where to move it: which t/z map an effect or variance
 * map goes with. These are menu items, so it renders inside AnalysisMenu's menu rather
 * than as a menu of its own. A t/z map has nothing more to say here. */
export function MapExtras({
    upload,
    statistics,
    folder,
    showDivider,
    onPartner,
}: {
    upload: ShareUpload;
    /** The t/z maps an effect or variance map could go with. */
    statistics: ShareUpload[];
    folder: string;
    /** Whether the analyses above need a line between them and this. */
    showDivider: boolean;
    onPartner: (partnerId: string | null) => void;
}) {
    const member = upload.kind === 'effect' || upload.kind === 'variance';
    if (!member) return null;
    return (
        <>
            {showDivider && <Divider />}
            <ListSubheader>Goes with</ListSubheader>
            <MenuItem dense selected={!upload.partner_id} onClick={() => onPartner(null)}>
                no t/z map
            </MenuItem>
            {statistics
                .filter((other) => other.id !== upload.id)
                .map((other) => (
                    <MenuItem
                        key={other.id}
                        dense
                        selected={other.id === upload.partner_id}
                        onClick={() => onPartner(other.id)}
                        sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}
                    >
                        {shownPath(other, folder)}
                    </MenuItem>
                ))}
        </>
    );
}

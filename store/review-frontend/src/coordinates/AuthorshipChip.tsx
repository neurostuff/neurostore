import { Chip } from '@mui/material';
import { authorship } from '../model/authorship';
import { parseOf, type CoordinateAnalysis } from '../model/coordinates';
import { useSession } from '../store/context';

const TITLES = {
    model: 'the pipeline’s revision made this analysis what it is',
    reviewer: 'a reviewer edited or judged this analysis',
};

/** Who made the analysis what it is, unless it is as the parse read it. */
export function AuthorshipChip({ analysis }: { analysis: CoordinateAnalysis }) {
    const parse = useSession((s) => parseOf(s.bundle).parse);
    const loaded = useSession((s) => parseOf(s.bundle).loaded);
    const provenance = useSession((s) => s.provenance);
    const by = authorship(analysis, parse, loaded, provenance);
    if (!by) return null;
    return (
        <Chip
            size="small"
            variant="outlined"
            color={by === 'model' ? 'secondary' : 'primary'}
            label={by}
            title={TITLES[by]}
        />
    );
}

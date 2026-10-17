import { Button, Typography } from '@mui/material';
import { analysisNamedBy, currentAnalyses, entitiesNaming, type CoordinateAnalysis } from '../model/coordinates';
import type { EntityNode } from '../model/record';
import { useSession, useView } from '../store/context';

const pointCount = (n: number) => `${n} ${n === 1 ? 'point' : 'points'}`;

interface Link {
    key: string;
    /** The link's accessible name. */
    label: string;
    text: string;
    open(): void;
}

/** A caption naming where something else is told: `heading`, then each link. */
function LinkRow({ heading, links }: { heading: string; links: Link[] }) {
    if (links.length === 0) return null;
    return (
        <Typography variant="caption" color="text.secondary" component="div">
            {`${heading}: `}
            {links.map((link) => (
                <Button
                    key={link.key}
                    size="small"
                    aria-label={link.label}
                    sx={{ py: 0, minWidth: 0, textTransform: 'none' }}
                    onClick={(event) => {
                        event.stopPropagation();
                        link.open();
                    }}
                >
                    {`${link.text} →`}
                </Button>
            ))}
        </Typography>
    );
}

/** The record entities naming `analysis`, each a link that opens it on the Analyses step. */
export function NamedBy({ analysis }: { analysis: CoordinateAnalysis }) {
    const named = useSession((s) => entitiesNaming(s.index, analysis.key));
    const setStep = useView((s) => s.setStep);
    const focusEntity = useView((s) => s.focusEntity);
    return (
        <LinkRow
            heading="Described in Analyses"
            links={named.map((entity) => ({
                key: entity.id,
                label: `open the record’s ${entity.name}`,
                text: entity.name,
                open: () => {
                    setStep('analyses');
                    focusEntity(entity.id);
                },
            }))}
        />
    );
}

/** The coordinate analysis a record entity names, as a link that opens it on the Coordinates step. */
export function CoordinatesOf({ entity }: { entity: EntityNode }) {
    const analysis = useSession((s) => analysisNamedBy(entity, currentAnalyses(s.bundle)));
    const setStep = useView((s) => s.setStep);
    const focusAnalysis = useView((s) => s.focusAnalysis);
    return (
        <LinkRow
            heading="Coordinates"
            links={
                analysis
                    ? [
                          {
                              key: analysis.key,
                              label: `open the coordinates of ${analysis.name}`,
                              text: `${analysis.name} · ${pointCount(analysis.points?.length ?? 0)}`,
                              open: () => {
                                  setStep('coordinates');
                                  focusAnalysis(analysis.key);
                              },
                          },
                      ]
                    : []
            }
        />
    );
}

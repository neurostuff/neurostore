import { alpha, useTheme } from '@mui/material/styles';
import { TableCell, TableRow } from '@mui/material';
import { flexRender, type Row } from '@tanstack/react-table';
import type { ImageReturn } from 'neurostore-typescript-sdk';
import React, { memo } from 'react';
import type { IStoreAnalysis } from 'stores/study/StudyStore.helpers';
import { AnalysisNameCell } from './AnalysisNameCell';
import {
    STUDY_ANALYSES_COLUMN_WIDTH,
    STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX,
    studyAnalysisStickyBodySx,
} from './editStudyAnalysisBoard.constants';
import type { AnalysisBoardRow } from './editStudyAnalysisBoard.types';

export type EditStudyAnalysisTableRowProps = {
    row: Row<AnalysisBoardRow>;
    selectedMapId: string | null;
    mapsForParent: ImageReturn[];
    storeAnalysis: IStoreAnalysis | undefined;
    analysisEnabled: Record<string, boolean>;
    toggleAnalysisExpanded: (analysisId: string) => void;
    handleAnalysisMenuOpen: (e: React.MouseEvent<HTMLElement>, analysis: IStoreAnalysis) => void;
    setSelectedMapId: (id: string) => void;
    handleRemoveMapFromAnalysis: (analysisId: string, map: ImageReturn) => void;
};

function editStudyAnalysisTableRowPropsEqual(
    a: EditStudyAnalysisTableRowProps,
    b: EditStudyAnalysisTableRowProps
): boolean {
    return (
        a.row.original === b.row.original &&
        a.row.id === b.row.id &&
        a.selectedMapId === b.selectedMapId &&
        a.mapsForParent === b.mapsForParent &&
        a.storeAnalysis === b.storeAnalysis &&
        a.analysisEnabled === b.analysisEnabled
    );
}

export const EditStudyAnalysisTableRow = memo(function EditStudyAnalysisTableRow({
    row,
    selectedMapId,
    mapsForParent,
    storeAnalysis,
    analysisEnabled,
    toggleAnalysisExpanded,
    handleAnalysisMenuOpen,
    setSelectedMapId,
    handleRemoveMapFromAnalysis,
}: EditStudyAnalysisTableRowProps) {
    const theme = useTheme();
    const isDetailRow = row.original.rowKind === 'detail';

    return (
        <TableRow
            hover={row.original.rowKind === 'analysis'}
            onClick={row.original.rowKind === 'analysis' ? () => toggleAnalysisExpanded(row.original.id) : undefined}
            sx={{
                cursor: row.original.rowKind === 'analysis' ? 'pointer' : 'default',
                ...(row.original.rowKind === 'analysis' && {
                    '& > td': { minHeight: STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX },
                }),
            }}
        >
            {row.getVisibleCells().map((cell) => {
                const isAnalysis = cell.column.id === 'analysis';
                return (
                    <TableCell
                        key={cell.id}
                        sx={{
                            verticalAlign: 'top',
                            p: 0,
                            ...(isAnalysis
                                ? {
                                      ...studyAnalysisStickyBodySx,
                                      width: STUDY_ANALYSES_COLUMN_WIDTH,
                                      minWidth: STUDY_ANALYSES_COLUMN_WIDTH,
                                      maxWidth: STUDY_ANALYSES_COLUMN_WIDTH,
                                  }
                                : isDetailRow
                                  ? {
                                        borderLeft: 'none',
                                        borderBottom: 1,
                                        borderColor: 'divider',
                                        fontSize: '0.8125rem',
                                        minWidth: 112,
                                        width: 120,
                                    }
                                  : {
                                        borderLeft: 1,
                                        borderColor: 'divider',
                                        fontSize: '0.8125rem',
                                        minWidth: 112,
                                        width: 120,
                                    }),
                        }}
                    >
                        {cell.column.id === 'analysis' ? (
                            <AnalysisNameCell
                                row={row.original}
                                analysis={storeAnalysis}
                                mapsForParent={mapsForParent}
                                selectedMapId={selectedMapId}
                                analysisEnabled={analysisEnabled}
                                onToggleExpand={toggleAnalysisExpanded}
                                onOpenMenu={handleAnalysisMenuOpen}
                                onSelectMap={setSelectedMapId}
                                onRemoveMap={handleRemoveMapFromAnalysis}
                            />
                        ) : (
                            flexRender(cell.column.columnDef.cell, cell.getContext())
                        )}
                    </TableCell>
                );
            })}
        </TableRow>
    );
}, editStudyAnalysisTableRowPropsEqual);

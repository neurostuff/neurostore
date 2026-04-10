import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { flexRender, type Table as TanstackTable } from '@tanstack/react-table';
import type { ImageReturn } from 'neurostore-typescript-sdk';
import React from 'react';
import type { IStoreAnalysis } from 'stores/study/StudyStore.helpers';
import { EditStudyAnalysisTableRow } from './EditStudyAnalysisTableRow';
import {
    STUDY_ANALYSES_COLUMN_WIDTH,
    STUDY_ANALYSIS_TABLE_MAX_HEIGHT,
    studyAnalysisStickyHeaderSx,
} from './editStudyAnalysisBoard.constants';
import type { AnalysisBoardRow } from './editStudyAnalysisBoard.types';

export type EditStudyAnalysisTableProps = {
    table: TanstackTable<AnalysisBoardRow>;
    tableMinWidth: number;
    mapsByAnalysisId: Record<string, ImageReturn[]>;
    analyses: IStoreAnalysis[];
    selectedMapId: string | null;
    analysisEnabled: Record<string, boolean>;
    toggleAnalysisExpanded: (analysisId: string) => void;
    handleAnalysisMenuOpen: (e: React.MouseEvent<HTMLElement>, analysis: IStoreAnalysis) => void;
    setSelectedMapId: (id: string) => void;
    handleRemoveMapFromAnalysis: (analysisId: string, map: ImageReturn) => void;
    emptyMaps: ImageReturn[];
};

export function EditStudyAnalysisTable({
    table,
    tableMinWidth,
    mapsByAnalysisId,
    analyses,
    selectedMapId,
    analysisEnabled,
    toggleAnalysisExpanded,
    handleAnalysisMenuOpen,
    setSelectedMapId,
    handleRemoveMapFromAnalysis,
    emptyMaps,
}: EditStudyAnalysisTableProps) {
    return (
        <Paper
            data-testid="edit-study-analysis-table"
            sx={{
                flex: 1,
                minWidth: 0,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1,
                overflow: 'hidden',
            }}
        >
            <TableContainer
                sx={{
                    maxHeight: STUDY_ANALYSIS_TABLE_MAX_HEIGHT,
                    overflow: 'auto',
                    bgcolor: 'background.paper',
                }}
            >
                <Table
                    stickyHeader
                    size="small"
                    sx={{
                        minWidth: tableMinWidth,
                        borderCollapse: 'separate',
                        borderSpacing: 0,
                        tableLayout: 'fixed',
                    }}
                >
                    <TableHead>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    const isAnalysis = header.column.id === 'analysis';
                                    return (
                                        <TableCell
                                            key={header.id}
                                            sx={{
                                                py: 1,
                                                ...(isAnalysis
                                                    ? {
                                                          ...studyAnalysisStickyHeaderSx,
                                                          width: STUDY_ANALYSES_COLUMN_WIDTH,
                                                          minWidth: STUDY_ANALYSES_COLUMN_WIDTH,
                                                          maxWidth: STUDY_ANALYSES_COLUMN_WIDTH,
                                                      }
                                                    : {
                                                          bgcolor: 'background.paper',
                                                          borderBottom: 1,
                                                          borderLeft: 1,
                                                          borderColor: 'divider',
                                                          minWidth: 112,
                                                          width: 120,
                                                      }),
                                            }}
                                        >
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(header.column.columnDef.header, header.getContext())}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHead>
                    <TableBody>
                        {table.getRowModel().rows.map((row) => {
                            const orig = row.original;
                            const mapsForParent = orig.parentAnalysisId
                                ? (mapsByAnalysisId[orig.parentAnalysisId] ?? emptyMaps)
                                : emptyMaps;
                            const storeAnalysis =
                                orig.rowKind === 'analysis' ? analyses.find((a) => a.id === orig.id) : undefined;
                            return (
                                <EditStudyAnalysisTableRow
                                    key={row.id}
                                    row={row}
                                    selectedMapId={selectedMapId}
                                    mapsForParent={mapsForParent}
                                    storeAnalysis={storeAnalysis}
                                    analysisEnabled={analysisEnabled}
                                    toggleAnalysisExpanded={toggleAnalysisExpanded}
                                    handleAnalysisMenuOpen={handleAnalysisMenuOpen}
                                    setSelectedMapId={setSelectedMapId}
                                    handleRemoveMapFromAnalysis={handleRemoveMapFromAnalysis}
                                />
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
}

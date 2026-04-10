import type { Theme } from '@mui/material/styles';

export const STUDY_ANALYSES_COLUMN_WIDTH = 260;
export const STUDY_ANALYSIS_TABLE_MAX_HEIGHT = 'min(560px, calc(100vh - 240px))';
export const STUDY_ANALYSIS_TABLE_ROW_MIN_HEIGHT_PX = 72;
export const STUDY_BRAIN_MAPS_DETAIL_ROW_SUFFIX = '__brainMaps';

export const STUDY_UNCATEGORIZED_MAPS_COLUMN_WIDTH = { xs: '160px', md: '300px' };
export const STUDY_UNCATEGORIZED_MAPS_COLLAPSED_WIDTH = 40;

/** Placeholder column header menu — behavior to be implemented later. */
export const STUDY_ANNOTATION_COLUMN_HEADER_MENU_ITEMS = ['Fill', 'Sort', 'Filter', 'Clear', 'Freeze column'] as const;

export const studyAnalysisStickyHeaderSx = {
    position: 'sticky',
    left: 0,
    zIndex: 4,
    bgcolor: 'background.paper',
    borderRight: 1,
    borderColor: 'divider',
    borderBottom: (theme: Theme) => `1px solid ${theme.palette.divider}`,
};

export const studyAnalysisStickyBodySx = {
    position: 'sticky',
    left: 0,
    zIndex: 2,
    bgcolor: 'background.paper',
    borderRight: 1,
    borderColor: 'divider',
};

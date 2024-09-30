import { Box, Chip, Typography } from '@mui/material';
import { ColumnFiltersState, SortingState } from '@tanstack/react-table';
import { useGetStudysetById } from 'hooks';
import { useProjectExtractionStudysetId, useProjectId } from 'pages/Project/store/ProjectStore';
import { useMemo } from 'react';

const DisplayExtractionTableState: React.FC = (props) => {
    const projectId = useProjectId();
    const studysetId = useProjectExtractionStudysetId();
    const { data } = useGetStudysetById(studysetId);
    const { columnFilters, sorting, studies } = useMemo(() => {
        try {
            const state = window.sessionStorage.getItem(`${projectId}-extraction-table`);
            const parsedState = JSON.parse(state || '{}') as {
                columnFilters: ColumnFiltersState;
                sorting: SortingState;
                studies: string[];
            };
            if (!state) {
                return {
                    columnFilters: [],
                    sorting: [],
                    studies: [],
                };
            }

            return {
                columnFilters: parsedState.columnFilters,
                sorting: parsedState.sorting,
                studies: parsedState.studies,
            };
        } catch (e) {
            return {
                columnFilters: [],
                sorting: [],
                studies: [],
            };
        }
    }, [projectId]);

    return (
        <Box sx={{ maxWidth: '60%', textAlign: 'center' }}>
            {columnFilters
                .filter((filter) => !!filter.value)
                .map((filter) => (
                    <Chip
                        key={filter.id}
                        color="primary"
                        variant="outlined"
                        sx={{ margin: '1px', fontSize: '12px', maxWidth: '200px' }}
                        label={`Filtering ${filter.id.toUpperCase()}: ${filter.value}`}
                        size="small"
                    />
                ))}
            {sorting.map((sort) => (
                <Chip
                    key={sort.id}
                    color="secondary"
                    variant="outlined"
                    sx={{ margin: '1px', fontSize: '12px', maxWidth: '200px' }}
                    label={`Sorting by ${sort.id.toUpperCase()}: ${sort.desc ? 'desc' : 'asc'}`}
                    size="small"
                />
            ))}
            <Typography variant="body2" sx={{ display: 'inline', marginLeft: '8px' }}>
                ({studies.length} / {data?.studies?.length || 0} studies)
            </Typography>
        </Box>
    );
};

export default DisplayExtractionTableState;

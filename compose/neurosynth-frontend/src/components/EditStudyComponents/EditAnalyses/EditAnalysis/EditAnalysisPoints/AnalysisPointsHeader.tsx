import { Box, Button, MenuList, MenuItem } from '@mui/material';
import { NeurosynthPopper, ProgressLoader } from 'components';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import AddIcon from '@mui/icons-material/Add';
import { useRef, useState } from 'react';
import { useGridApiContext } from '@mui/x-data-grid';
import { useGetStudyById } from 'hooks';
import { AnalysisApiResponse } from 'utils/api';
import { AnalysisReturn, PointReturn } from 'neurostore-typescript-sdk';

export interface IAnalysisPointsHeader {
    studyId: string | undefined;
    analysisId: string | undefined;
    onCreatePoint: () => void;
    onMovePoints: (moveToAnalysisId: string, selectedPointIds: string[]) => void;
}

const AnalysisPointsHeader: React.FC<IAnalysisPointsHeader> = (props) => {
    const apiRef = useGridApiContext();
    const { isLoading: getStudyIsLoading, data: study } = useGetStudyById(props.studyId || '');
    const selectedRows = apiRef?.current?.getSelectedRows()?.size || 0;

    const [popperIsOpen, setPopperIsOpen] = useState(false);
    const buttonRef = useRef<HTMLButtonElement>(null);

    const handleMenuItemSelected = (analysisId: string | undefined) => {
        if (analysisId && apiRef?.current && study?.analyses) {
            const updatedAnalyses = [...study.analyses] as AnalysisReturn[];
            const selectedPointIds = [...apiRef?.current?.getSelectedRows().keys()] as string[];

            const moveToAnalysisIndex = updatedAnalyses.findIndex(
                (oldAnalysis) => oldAnalysis?.id === analysisId
            );
            if (moveToAnalysisIndex < 0) return;

            const moveToAnalysisExistingPoints = (
                updatedAnalyses[moveToAnalysisIndex].points as PointReturn[]
            ).map((x) => x?.id || '');
            moveToAnalysisExistingPoints.push(...selectedPointIds);

            props.onMovePoints(analysisId, moveToAnalysisExistingPoints);
        }
    };

    const analysisOptions = ((study?.analyses || []) as AnalysisApiResponse[])
        .filter((x) => x.id !== props.analysisId)
        .map((analysis, index) => (
            <MenuItem
                onClick={(_event) => {
                    handleMenuItemSelected(analysis.id);
                    setPopperIsOpen(false);
                }}
                key={analysis?.id || index}
            >
                {analysis?.name || ''}
            </MenuItem>
        ));

    if (analysisOptions.length === 0)
        analysisOptions.push(<MenuItem disabled>No analyses</MenuItem>);

    return (
        <Box
            sx={{
                height: '70px',
                borderBottom: '1px solid lightgray',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}
        >
            <Button
                onClick={(_event) => setPopperIsOpen(true)}
                ref={buttonRef}
                sx={{
                    margin: '0 1rem',
                    display: selectedRows > 0 ? 'inherit' : 'none',
                }}
                variant="outlined"
                startIcon={<CompareArrowsIcon />}
            >
                Move {selectedRows} point(s) to another analysis
            </Button>

            <Button
                startIcon={<AddIcon />}
                sx={{ width: '200px', margin: '0 1rem' }}
                onClick={(_event) => props.onCreatePoint()}
                variant="outlined"
                color="primary"
            >
                new point
            </Button>

            <NeurosynthPopper
                onClickAway={(_event) => setPopperIsOpen(false)}
                anchorElement={buttonRef.current}
                open={popperIsOpen}
            >
                <MenuList sx={{ minWidth: '250px' }}>
                    {getStudyIsLoading ? (
                        <ProgressLoader size="1.5rem" sx={{ display: 'block', margin: '0 auto' }} />
                    ) : (
                        analysisOptions
                    )}
                </MenuList>
            </NeurosynthPopper>
        </Box>
    );
};

export default AnalysisPointsHeader;

import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Box,
    Chip,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import NavigationButtons, {
    ENavigationButton,
} from 'components/Buttons/NavigationButtons/NavigationButtons';
import ReadOnlyStubSummary from 'components/CurationComponents/CurationImport/ReadOnlyStubSummary';
import { ICurationStubStudy } from 'components/CurationComponents/CurationStubStudy/CurationStubStudyDraggableContainer';
import React from 'react';
import DuplicateCaseStyles from './DuplicateCase.styles';

type IResolveProjectDuplicatesCurationStubStudy = ICurationStubStudy & {
    columnIndex?: number;
    studyIndex?: number;
    resolution?: 'duplicate' | 'not-duplicate' | 'resolved';
    colName?: string;
};

const DuplicateCase: React.FC<{
    index: number;
    importedStub: ICurationStubStudy & {
        index: number;
        resolution?: 'duplicate' | 'not-duplicate';
    };
    projectDuplicates: IResolveProjectDuplicatesCurationStubStudy[];
    isExpanded: boolean;
    onExpand: (index: number) => void;
    onResolve: (
        isImportedStub: boolean,
        duplicateCaseIndex: number,
        duplicateStubIndex: number,
        resolution?: 'duplicate' | 'not-duplicate' | undefined
    ) => void;
    onPrevOrNextCase: (navigation: ENavigationButton) => void;
}> = React.memo((props) => {
    const {
        importedStub,
        projectDuplicates,
        index,
        isExpanded,
        onExpand,
        onResolve,
        onPrevOrNextCase,
    } = props;
    const isResolved = importedStub.resolution && projectDuplicates.every((x) => x.resolution);

    return (
        <Accordion elevation={0} expanded={isExpanded} onChange={() => onExpand(index)}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                {isResolved ? (
                    <CheckCircleOutlineIcon color="success" />
                ) : (
                    <ErrorOutlineIcon color="warning" />
                )}
                <Typography
                    sx={{
                        color: isResolved ? 'success.dark' : 'warning.dark',
                        marginLeft: '1rem',
                    }}
                >
                    {isResolved ? 'Resolved' : 'Unresolved'}
                </Typography>
            </AccordionSummary>
            <AccordionDetails>
                <Typography sx={{ fontWeight: 'bold', marginBottom: '1rem' }} variant="h6">
                    This is the study you are importing
                </Typography>
                <Box sx={DuplicateCaseStyles.resolutionContainer}>
                    <Box sx={[DuplicateCaseStyles.studyContainer]}>
                        <ReadOnlyStubSummary {...importedStub} />
                    </Box>
                    <Box sx={{ width: '310px' }}>
                        <ToggleButtonGroup
                            exclusive
                            value={importedStub.resolution}
                            onChange={(_, resolution: 'duplicate' | 'not-duplicate' | null) =>
                                onResolve(
                                    true,
                                    index,
                                    0, // not used
                                    resolution ? resolution : undefined
                                )
                            }
                        >
                            <ToggleButton color="primary" value="not-duplicate">
                                Keep this study
                            </ToggleButton>
                            <ToggleButton color="error" value="duplicate">
                                This is a duplicate
                            </ToggleButton>
                        </ToggleButtonGroup>
                    </Box>
                </Box>

                <Typography sx={{ fontWeight: 'bold', margin: '1rem 0' }} variant="h6">
                    These studies exist within the project
                </Typography>
                {projectDuplicates.map((stub, duplicateStubIndex) => (
                    <Box
                        key={stub.id}
                        sx={[DuplicateCaseStyles.resolutionContainer, { marginBottom: '0.5rem' }]}
                    >
                        <Box sx={[DuplicateCaseStyles.studyContainer]}>
                            <Chip size="small" color="info" label={`Status: ${stub.colName}`} />
                            <ReadOnlyStubSummary {...stub} />
                        </Box>
                        <Box sx={{ width: '310', display: 'flex', flexDirection: 'column' }}>
                            {stub.resolution === 'resolved' ? (
                                <Typography variant="h6" sx={{ color: 'error.dark' }}>
                                    Excluded: {stub.exclusionTag?.label}
                                </Typography>
                            ) : (
                                <ToggleButtonGroup
                                    exclusive
                                    value={stub.resolution}
                                    onChange={(
                                        _,
                                        resolution: 'duplicate' | 'not-duplicate' | null
                                    ) =>
                                        onResolve(
                                            false,
                                            index,
                                            duplicateStubIndex,
                                            resolution ? resolution : undefined
                                        )
                                    }
                                >
                                    <ToggleButton color="primary" value="not-duplicate">
                                        Keep this study
                                    </ToggleButton>
                                    <ToggleButton color="error" value="duplicate">
                                        This is a duplicate
                                    </ToggleButton>
                                </ToggleButtonGroup>
                            )}
                            {(stub.columnIndex || 0) > 0 && stub.resolution === 'duplicate' && (
                                <Box sx={{ display: 'flex', alignItems: 'center', width: '310px' }}>
                                    <ErrorOutlineIcon color="warning" />
                                    <Typography
                                        sx={{
                                            color: 'warning.dark',
                                            marginTop: '8px',
                                            marginLeft: '8px',
                                        }}
                                    >
                                        This study has already been promoted
                                        {stub.colName ? ` to ${stub.colName}` : ''}. It will be
                                        demoted and marked as a duplicate.
                                    </Typography>
                                </Box>
                            )}
                        </Box>
                    </Box>
                ))}

                <Box sx={{ margin: '1rem 0' }}>
                    <NavigationButtons
                        nextButtonStyle="contained"
                        prevButtonDisabled={index === 0}
                        nextButtonDisabled={!isResolved}
                        onButtonClick={onPrevOrNextCase}
                    />
                </Box>
            </AccordionDetails>
        </Accordion>
    );
});

export default DuplicateCase;

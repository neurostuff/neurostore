import { Box, Button, Link, Typography } from '@mui/material';
import BaseDialog from 'components/Dialogs/BaseDialog';
import { EAnalysisType } from 'hooks/projects/Project.types';
import { useState } from 'react';

const analysisTypes = [
    {
        name: 'CBMA',
        description: (
            <>
                Coordinate-based meta-analysis. <br /> Meta-analyze brain coordinates from multiple studies.
            </>
        ),
        value: EAnalysisType.CBMA,
        href: 'https://nimare.readthedocs.io/en/latest/auto_examples/02_meta-analyses/10_plot_cbma_workflow.html',
    },
    {
        name: 'IBMA',
        description: (
            <>
                Image-based meta-analysis. <br /> Meta-analyze full brain images or statistical maps.
            </>
        ),
        value: EAnalysisType.IBMA,
        href: 'https://nimare.readthedocs.io/en/0.2.1/auto_examples/02_meta-analyses/12_plot_ibma_workflow.html',
    },
];

export interface ICreateProjectDialog {
    isOpen: boolean;
    onCloseDialog: (value: EAnalysisType | undefined) => void;
}

const CreateProjectDialog: React.FC<ICreateProjectDialog> = ({ isOpen, onCloseDialog }) => {
    const [selectedOption, setSelectedOption] = useState<EAnalysisType | undefined>(EAnalysisType.CBMA);

    const handleClose = () => {
        setSelectedOption(EAnalysisType.CBMA);
        onCloseDialog(undefined);
    };

    const handleCreate = () => {
        onCloseDialog(selectedOption);
        setSelectedOption(EAnalysisType.CBMA);
    };

    return (
        <BaseDialog isOpen={isOpen} dialogTitle="Create Project" onCloseDialog={handleClose}>
            <Box>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    {analysisTypes.map((analysisType) => (
                        <Button
                            key={analysisType.value}
                            fullWidth
                            variant={selectedOption === analysisType.value ? 'contained' : 'outlined'}
                            color="primary"
                            onClick={() => setSelectedOption(analysisType.value)}
                            sx={{ py: 3, flex: 1 }}
                        >
                            <Box
                                sx={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    textAlign: 'center',
                                    gap: 0.5,
                                }}
                            >
                                <Typography variant="h6" component="span">
                                    {analysisType.name}
                                </Typography>
                                <Typography variant="body2" component="span" sx={{ textTransform: 'none' }}>
                                    {analysisType.description}
                                </Typography>
                            </Box>
                        </Button>
                    ))}
                </Box>
                <Box sx={{ display: 'flex', gap: 2, mt: 1, mb: 2 }}>
                    {analysisTypes.map((analysisType) => (
                        <Box sx={{ flex: 1 }} key={analysisType.value}>
                            <Link href={analysisType.href} target="_blank" underline="hover" typography="body2">
                                Learn more about {analysisType.name}
                            </Link>
                        </Box>
                    ))}
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Button variant="outlined" onClick={handleClose} sx={{ mr: 1 }}>
                        Cancel
                    </Button>
                    <Button variant="contained" color="primary" disableElevation onClick={handleCreate}>
                        Create
                    </Button>
                </Box>
            </Box>
        </BaseDialog>
    );
};

export default CreateProjectDialog;

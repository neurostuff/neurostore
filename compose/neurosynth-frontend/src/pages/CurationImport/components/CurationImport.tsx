import { Box, Step, StepLabel, Stepper, Typography } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import CurationImportFinalize from './CurationImportFinalize';
import CurationImportSelectMethod from './CurationImportSelectMethod';
import { EImportMode } from 'pages/CurationImport/CurationImport.types';
import CurationImportDoImport from 'pages/CurationImport/components/CurationImportDoImport';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';

const CurationImport: React.FC = () => {
    const [activeStep, setActiveStep] = useState(0);
    const [importMode, setImportMode] = useState<EImportMode>(EImportMode.NEUROSTORE_IMPORT);
    const [stubs, setStubs] = useState<ICurationStubStudy[]>([]);
    const location = useLocation();

    useEffect(() => {
        if (location?.search) {
            setImportMode(EImportMode.NEUROSTORE_IMPORT);
            setActiveStep(1);
        }
    }, [location?.search]);

    const handleChangeImportMode = (newImportMode: EImportMode) => {
        setImportMode(newImportMode);
    };

    const handleNavigate = (button: ENavigationButton) => {
        setActiveStep((prev) => {
            if (button === ENavigationButton.NEXT) {
                if (activeStep < 2) {
                    return prev + 1;
                } else {
                    return prev;
                }
            } else {
                if (activeStep > 0) return prev - 1;
                return prev;
            }
        });
    };

    return (
        <Box>
            <Stepper activeStep={activeStep}>
                <Step>
                    <StepLabel>Choose Method</StepLabel>
                </Step>
                <Step>
                    <StepLabel>
                        <Typography sx={{ display: 'inline' }} variant="body2">
                            Import
                        </Typography>
                    </StepLabel>
                </Step>
                <Step>
                    <StepLabel>
                        <Typography sx={{ display: 'inline' }} variant="body2">
                            Name and Review
                        </Typography>
                    </StepLabel>
                </Step>
            </Stepper>
            <Box>
                {activeStep === 0 && (
                    <CurationImportSelectMethod
                        importMethod={importMode}
                        onChangeImportMode={handleChangeImportMode}
                        onNavigate={handleNavigate}
                    />
                )}
                {activeStep === 1 && (
                    <CurationImportDoImport
                        stubs={stubs}
                        onImportStubs={setStubs}
                        mode={importMode}
                        onNavigate={handleNavigate}
                    />
                )}
                {activeStep === 2 && (
                    <CurationImportFinalize importMode={importMode} stubs={stubs} onNavigate={handleNavigate} />
                )}
            </Box>
        </Box>
    );
};

export default CurationImport;

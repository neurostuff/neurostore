import { Box, Step, StepLabel, Stepper, Typography } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import CurationImportFinalize from './CurationImportFinalize';
import CurationImportSelectMethod from './CurationImportSelectMethod';
import { EImportMode } from 'pages/CurationImport/CurationImport.types';
import CurationImportDoImport from 'pages/CurationImport/components/CurationImportDoImport';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';

const CurationImport: React.FC = (props) => {
    const [activeStep, setActiveStep] = useState(0);
    const [importMode, setImportMode] = useState<EImportMode>(EImportMode.NEUROSTORE_IMPORT);
    const [isResolvingDuplicates, setIsResolvingDuplicates] = useState(false);
    const [stubs, setStubs] = useState<ICurationStubStudy[]>([]);
    const [unimportedStubs, setUnimportedStubs] = useState<string[]>([]);
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
        setIsResolvingDuplicates(false);
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

    const handleImportStubs = (stubs: ICurationStubStudy[], unimportedStubs?: string[]) => {
        setStubs(stubs);
        if (unimportedStubs) setUnimportedStubs(unimportedStubs);
    };

    const secondStepIsResolvingDuplicates = useMemo(() => {
        return isResolvingDuplicates && activeStep === 1;
    }, [activeStep, isResolvingDuplicates]);

    const thirdStepIsResolvingDuplicates = useMemo(() => {
        return isResolvingDuplicates && activeStep === 2;
    }, [activeStep, isResolvingDuplicates]);

    return (
        <Box>
            <Stepper activeStep={activeStep}>
                <Step>
                    <StepLabel>Choose Method</StepLabel>
                </Step>
                <Step>
                    <StepLabel
                        sx={{
                            '.MuiStepLabel-iconContainer': {
                                svg: {
                                    color: secondStepIsResolvingDuplicates ? 'warning.dark' : '',
                                },
                            },
                        }}
                    >
                        <Typography
                            sx={{
                                color: secondStepIsResolvingDuplicates ? 'warning.dark' : 'inherit',
                                display: 'inline',
                            }}
                            variant="body2"
                        >
                            Import
                        </Typography>
                        {secondStepIsResolvingDuplicates && (
                            <Typography
                                variant="body2"
                                sx={{ color: 'warning.dark', display: 'inline' }}
                            >
                                {' '}
                                (resolving duplicates...)
                            </Typography>
                        )}
                    </StepLabel>
                </Step>
                <Step>
                    <StepLabel
                        sx={{
                            '.MuiStepLabel-iconContainer': {
                                svg: {
                                    color: thirdStepIsResolvingDuplicates ? 'warning.dark' : '',
                                },
                            },
                        }}
                    >
                        <Typography
                            sx={{
                                color: thirdStepIsResolvingDuplicates ? 'warning.dark' : 'inherit',
                                display: 'inline',
                            }}
                            variant="body2"
                        >
                            Name and Review
                        </Typography>
                        {thirdStepIsResolvingDuplicates && (
                            <Typography
                                variant="body2"
                                sx={{ color: 'warning.dark', display: 'inline' }}
                            >
                                {' '}
                                (resolving duplicates...)
                            </Typography>
                        )}
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
                        onIsResolvingDuplicates={(val) => setIsResolvingDuplicates(val)}
                        isResolvingDuplicates={isResolvingDuplicates}
                        onImportStubs={handleImportStubs}
                        mode={importMode}
                        onNavigate={handleNavigate}
                    />
                )}
                {activeStep === 2 && (
                    <CurationImportFinalize
                        importMode={importMode}
                        onIsResolvingDuplicates={(val) => setIsResolvingDuplicates(val)}
                        isResolvingDuplicates={isResolvingDuplicates}
                        stubs={stubs}
                        unimportedStubs={unimportedStubs}
                        onNavigate={handleNavigate}
                    />
                )}
            </Box>
        </Box>
    );
};

export default CurationImport;

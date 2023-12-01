import { Step, StepLabel, Stepper, Box, Typography } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ICurationStubStudy } from '../CurationStubStudy/CurationStubStudyDraggableContainer';
import CurationImportResolveDuplicates from './CurationImportResolveDuplicates/CurationImportResolveDuplicates';
import CurationImportSelectMethod from './CurationImportSelectMethod/CurationImportSelectMethod';
import CurationImportReview from './CurationImportReview/CurationImportReview';
import CurationImportTag from './CurationImportTag/CurationImportTag';
import CurationDoImport, {
    EImportMode,
} from 'components/CurationComponents/CurationImport/CurationDoImport/CurationDoImport';

const CurationImportBase: React.FC = (props) => {
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
                if (activeStep < 4) return prev + 1;
                return prev;
            } else {
                if (activeStep > 0) return prev - 1;
                return prev;
            }
        });
    };

    const handleImportStubs = (stubs: ICurationStubStudy[], unimportedStubs?: string[]) => {
        setStubs(stubs);
        if (unimportedStubs) setUnimportedStubs(unimportedStubs);
        setIsResolvingDuplicates(false);
        setActiveStep((prev) => prev + 1);
    };

    const secondStepIsResolvingDuplicates = useMemo(() => {
        return isResolvingDuplicates && activeStep === 1;
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
                    <StepLabel>Review</StepLabel>
                </Step>
                <Step>
                    <StepLabel>Tag</StepLabel>
                </Step>
                <Step>
                    <StepLabel>Resolve Duplicates</StepLabel>
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
                    <CurationDoImport
                        onIsResolvingDuplicates={(val) => setIsResolvingDuplicates(val)}
                        isResolvingDuplicates={isResolvingDuplicates}
                        onImportStubs={handleImportStubs}
                        mode={importMode}
                        onNavigate={handleNavigate}
                    />
                )}
                {activeStep === 2 && (
                    // TODO: need to add review component to this
                    // TODO: need to add duplicates accordion to this
                    // TODO: need to auto name import
                    <CurationImportTag
                        onUpdateStubs={(stubs) => setStubs(stubs)}
                        stubs={stubs}
                        onNavigate={handleNavigate}
                    />
                )}
                {activeStep === 3 && (
                    <CurationImportResolveDuplicates onNavigate={handleNavigate} stubs={stubs} />
                )}
            </Box>
        </Box>
    );
};

export default CurationImportBase;

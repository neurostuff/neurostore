import { Step, StepLabel, Stepper, Box } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ICurationStubStudy } from '../CurationStubStudy/CurationStubStudyDraggableContainer';
import CurationImport, { EImportMode } from './CurationImport/CurationImport';
import CurationImportResolveDuplicates from './CurationImportResolveDuplicates/CurationImportResolveDuplicates';
import CurationImportSelectMethod from './CurationImportSelectMethod/CurationImportSelectMethod';
import CurationImportTag from './CurationImportTag/CurationImportTag';

const CurationImportBase: React.FC = (props) => {
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
                if (activeStep < 3) return prev + 1;
                return prev;
            } else {
                if (activeStep > 0) return prev - 1;
                return prev;
            }
        });
    };

    const handleImportStubs = (stubs: ICurationStubStudy[]) => {
        setStubs(stubs);
        setActiveStep((prev) => prev + 1);
    };

    return (
        <Box>
            <Stepper activeStep={activeStep}>
                <Step>
                    <StepLabel>Choose Import Method</StepLabel>
                </Step>
                <Step>
                    <StepLabel>Import</StepLabel>
                </Step>
                <Step>
                    <StepLabel>Tag (optional)</StepLabel>
                </Step>
                <Step>
                    <StepLabel>Resolve Duplicates and import</StepLabel>
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
                    <CurationImport
                        onImportStubs={handleImportStubs}
                        mode={importMode}
                        onNavigate={handleNavigate}
                    />
                )}
                {activeStep === 2 && (
                    <CurationImportTag
                        onNavigate={handleNavigate}
                        onUpdateStubs={(stubs) => setStubs(stubs)}
                        stubs={stubs}
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

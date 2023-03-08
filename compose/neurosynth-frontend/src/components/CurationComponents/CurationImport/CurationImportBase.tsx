import { Step, StepLabel, Stepper, Box } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons/NavigationButtons';
import { useState } from 'react';
import { ICurationStubStudy } from '../CurationStubStudy/CurationStubStudyDraggableContainer';
import CurationImport, { EImportMode } from './CurationImport/CurationImport';
import CurationImportSelectMethod from './CurationImportSelectMethod/CurationImportSelectMethod';
import CurationImportTag from './CurationImportTag/CurationImportTag';

const CurationImportBase: React.FC = (props) => {
    const [activeStep, setActiveStep] = useState(0);
    const [importMode, setImportMode] = useState<EImportMode>(EImportMode.NEUROSTORE_IMPORT);
    const [stubs, setStubs] = useState<ICurationStubStudy[]>([]);

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
        console.log(stubs);
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
                {activeStep === 3 && <div>resolve duplicates</div>}
            </Box>
        </Box>
    );
};

export default CurationImportBase;

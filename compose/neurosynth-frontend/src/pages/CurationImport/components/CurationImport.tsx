import { Box, Step, StepLabel, Stepper } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { EImportMode } from 'pages/CurationImport/CurationImport.types';
import CurationImportDoImport from 'pages/CurationImport/components/CurationImportDoImport';
import { SearchCriteria } from 'pages/Study/Study.types';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import CurationImportFinalize from './CurationImportFinalize';
import CurationImportSelectMethod from './CurationImportSelectMethod';

const CurationImport: React.FC = () => {
    const [activeStep, setActiveStep] = useState(0);
    const [importMode, setImportMode] = useState<EImportMode>(EImportMode.NEUROSTORE_IMPORT);
    const [stubs, setStubs] = useState<ICurationStubStudy[]>([]);
    const [unimportedStubs, setUnimportedStubs] = useState<string[]>([]);
    const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>();
    const [fileName, setFileName] = useState<string>();
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

    useEffect(() => {
        // clear memory so we dont get weird side effects when people go back and change data/change import mode
        if (activeStep === 1) {
            setStubs([]);
            setUnimportedStubs([]);
            setSearchCriteria(undefined);
            setFileName(undefined);
        }
    }, [activeStep]);

    const handleImportStubs = (stubs: ICurationStubStudy[], unimportedStubs?: string[]) => {
        setStubs(stubs);
        if (unimportedStubs) setUnimportedStubs(unimportedStubs);
    };

    return (
        <Box>
            <Stepper activeStep={activeStep}>
                <Step>
                    <StepLabel>Choose Method</StepLabel>
                </Step>
                <Step>
                    <StepLabel>Import</StepLabel>
                </Step>
                <Step>
                    <StepLabel>Name and Review</StepLabel>
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
                        onImportStubs={handleImportStubs}
                        onSetSearchCriteria={setSearchCriteria}
                        onFileUpload={setFileName}
                        mode={importMode}
                        onNavigate={handleNavigate}
                    />
                )}
                {activeStep === 2 && (
                    <CurationImportFinalize
                        importMode={importMode}
                        searchCriteria={searchCriteria}
                        stubs={stubs}
                        unimportedStubs={unimportedStubs}
                        fileName={fileName}
                        onNavigate={handleNavigate}
                    />
                )}
            </Box>
        </Box>
    );
};

export default CurationImport;

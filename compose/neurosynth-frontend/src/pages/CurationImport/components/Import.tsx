import { Box, Step, StepLabel, Stepper } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { EImportMode } from 'pages/Curation/Curation.types';
import ImportDoImport from 'pages/CurationImport/components/ImportDoImport';
import { useProjectId } from 'stores/projects/ProjectStore';
import { SearchCriteria } from 'pages/Study/Study.types';
import { useEffect, useState } from 'react';
import ImportFinalize from './ImportFinalize';

const Import: React.FC<{ method: EImportMode; onClose: () => void }> = ({ method, onClose: onClose }) => {
    const [activeStep, setActiveStep] = useState(0);
    const [stubs, setStubs] = useState<ICurationStubStudy[]>([]);
    const [unimportedStubs, setUnimportedStubs] = useState<string[]>([]);
    const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>();
    const [fileName, setFileName] = useState<string>();
    const projectId = useProjectId();

    if (!projectId) return null;

    const handleClose = () => {
        setActiveStep(0);
        setStubs([]);
        setUnimportedStubs([]);
        setSearchCriteria(undefined);
        setFileName(undefined);
        onClose();
    };

    const handleNavigate = (button: ENavigationButton) => {
        setActiveStep((prev) => {
            if (button === ENavigationButton.NEXT) {
                if (prev >= 1) handleClose();
                else return prev + 1;
            } else {
                if (prev <= 0) handleClose();
                else return prev - 1;
            }
            return prev;
        });
    };

    useEffect(() => {
        if (activeStep === 0) {
            setStubs([]);
            setUnimportedStubs([]);
            setSearchCriteria(undefined);
            setFileName(undefined);
        }
    }, [activeStep]);

    const handleImportStubs = (newStubs: ICurationStubStudy[], newUnimportedStubs?: string[]) => {
        setStubs(newStubs);
        if (newUnimportedStubs) setUnimportedStubs(newUnimportedStubs);
    };

    return (
        <Box>
            <Stepper activeStep={activeStep}>
                <Step>
                    <StepLabel>Import</StepLabel>
                </Step>
                <Step>
                    <StepLabel>Name and Review</StepLabel>
                </Step>
            </Stepper>
            <Box>
                {activeStep === 0 && (
                    <ImportDoImport
                        onImportStubs={handleImportStubs}
                        onFileUpload={setFileName}
                        mode={method}
                        onNavigate={handleNavigate}
                    />
                )}
                {activeStep === 1 && (
                    <ImportFinalize
                        importMode={method}
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

export default Import;

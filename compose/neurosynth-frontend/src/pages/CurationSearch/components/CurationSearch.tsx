import { Box, Step, StepLabel, Stepper } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { EImportMode } from 'pages/CurationImport/CurationImport.types';
import CurationImportFinalize from 'pages/CurationImport/components/CurationImportFinalize';
import CurationSearchNeurostore from 'pages/CurationSearch/components/CurationSearchNeurostore';
import { SearchCriteria } from 'pages/Study/Study.types';
import { useEffect, useState } from 'react';
const CurationSearch: React.FC = () => {
    const [activeStep, setActiveStep] = useState(0);
    const [stubs, setStubs] = useState<ICurationStubStudy[]>([]);
    const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>();
    const unimportedStubs: string[] = [];
    const fileName: string | undefined = undefined;

    const handleNavigate = (button: ENavigationButton) => {
        if (button === ENavigationButton.NEXT) {
            if (activeStep < 1) setActiveStep(1);
        } else {
            if (activeStep > 0) setActiveStep(0);
        }
    };

    const handleImportStubs = (newStubs: ICurationStubStudy[], newUnimportedStubs?: string[]) => {
        setStubs(newStubs);
        if (newUnimportedStubs) {
            // Neurostore flow doesn't use unimportedStubs; keep for API compatibility
        }
    };

    useEffect(() => {
        if (activeStep === 0) {
            setStubs([]);
            setSearchCriteria(undefined);
        }
    }, [activeStep]);

    return (
        <Box>
            <Stepper activeStep={activeStep} sx={{ my: 3 }}>
                <Step>
                    <StepLabel>Search Neurostore</StepLabel>
                </Step>
                <Step>
                    <StepLabel>Name and Review</StepLabel>
                </Step>
            </Stepper>
            <Box>
                {activeStep === 0 && (
                    <CurationSearchNeurostore
                        onImportStubs={handleImportStubs}
                        onSetSearchCriteria={setSearchCriteria}
                        onNavigate={handleNavigate}
                    />
                )}
                {activeStep === 1 && (
                    <CurationImportFinalize
                        importMode={EImportMode.NEUROSTORE_IMPORT}
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

export default CurationSearch;

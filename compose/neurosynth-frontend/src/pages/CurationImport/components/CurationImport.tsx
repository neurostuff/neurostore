import { Box, Step, StepLabel, Stepper } from '@mui/material';
import { ENavigationButton } from 'components/Buttons/NavigationButtons';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import { EImportMode } from 'pages/CurationImport/CurationImport.types';
import CurationImportDoImport from 'pages/CurationImport/components/CurationImportDoImport';
import { SearchCriteria } from 'pages/Study/Study.types';
import { useEffect, useState } from 'react';
import { useLocation, Navigate, useNavigate } from 'react-router-dom';
import { useProjectId } from 'pages/Project/store/ProjectStore';
import CurationImportFinalize from './CurationImportFinalize';

const ALLOWED_IMPORT_MODES = Object.values(EImportMode) as EImportMode[];

const CurationImport: React.FC = () => {
    const [activeStep, setActiveStep] = useState(0);
    const [stubs, setStubs] = useState<ICurationStubStudy[]>([]);
    const [unimportedStubs, setUnimportedStubs] = useState<string[]>([]);
    const [searchCriteria, setSearchCriteria] = useState<SearchCriteria>();
    const [fileName, setFileName] = useState<string>();
    const location = useLocation();
    const projectId = useProjectId();
    const navigate = useNavigate();

    const methodParam = new URLSearchParams(location.search).get('method') as EImportMode | null;
    const importModeIsAllowed = methodParam && ALLOWED_IMPORT_MODES.includes(methodParam);
    const isNeurostoreMode = methodParam === EImportMode.NEUROSTORE_IMPORT;

    if (!projectId) return null;

    if (isNeurostoreMode) {
        return <Navigate to={`/projects/${projectId}/curation/search`} replace />;
    }
    if (!importModeIsAllowed) {
        return <Navigate to={`/projects/${projectId}/curation`} replace />;
    }

    const importMode = methodParam as EImportMode;

    const handleNavigate = (button: ENavigationButton) => {
        setActiveStep((prev) => {
            if (button === ENavigationButton.NEXT) {
                if (prev < 1) return prev + 1;
                return prev;
            } else {
                if (prev === 0) navigate(`/projects/${projectId}/curation`);
                else if (prev > 0) return prev - 1;
                return prev;
            }
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
                    <CurationImportDoImport
                        onImportStubs={handleImportStubs}
                        onFileUpload={setFileName}
                        mode={importMode}
                        onNavigate={handleNavigate}
                    />
                )}
                {activeStep === 1 && (
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

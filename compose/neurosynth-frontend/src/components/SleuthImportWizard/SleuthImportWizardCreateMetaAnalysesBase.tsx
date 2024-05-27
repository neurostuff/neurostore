import {
    Box,
    Button,
    FormControl,
    FormControlLabel,
    Radio,
    RadioGroup,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from '@mui/material';
import CurationImportBaseStyles from 'components/CurationComponents/CurationImport/CurationImportBase.styles';
import { IAlgorithmSelection } from 'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationDialogBase.types';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import useGetProjectById from 'hooks/projects/useGetProjectById';
import { useMemo, useState } from 'react';
import { ISleuthFileUploadStubs } from './SleuthImportWizard.utils';
import {
    getDefaultValuesForTypeAndParameter,
    metaAnalyticAlgorithms,
} from 'components/Dialogs/CreateMetaAnalysisSpecificationDialog/CreateMetaAnalysisSpecificationDialogConstants';
import { EAnalysisType } from 'hooks/metaAnalyses/useCreateAlgorithmSpecification';
import { IAutocompleteObject } from 'components/NeurosynthAutocomplete/NeurosynthAutocomplete';
import { useNavigate } from 'react-router-dom';
import SleuthImportWizardCreateMetaAnalysesCreate from './SleuthImportWizardCreateMetaAnalysesDetails';
import SleuthImportWizardCreateMetaAnalysesDetails from './SleuthImportWizardCreateMetaAnalysesConfig';

const SleuthImportWizardCreateMetaAnalysesBase: React.FC<{
    projectId: string;
    sleuthImports: ISleuthFileUploadStubs[];
}> = ({ projectId, sleuthImports }) => {
    const { data, isLoading, isError } = useGetProjectById(projectId);
    const navigate = useNavigate();
    const [currView, setCurrView] = useState<'CONFIG' | 'CREATE'>('CONFIG');

    const handleCreateMetaAnalysisDetails = (selectedAlgorithm: IAlgorithmSelection | null) => {
        if (selectedAlgorithm === null) {
            navigate(`/projects/${projectId}/meta-analyses`);
        } else {
            setCurrView('CREATE');
        }
    };

    return (
        <StateHandlerComponent isLoading={isLoading} isError={isError}>
            {currView === 'CONFIG' ? (
                <SleuthImportWizardCreateMetaAnalysesDetails
                    onNext={handleCreateMetaAnalysisDetails}
                />
            ) : (
                <SleuthImportWizardCreateMetaAnalysesCreate />
            )}
        </StateHandlerComponent>
    );
};

export default SleuthImportWizardCreateMetaAnalysesBase;

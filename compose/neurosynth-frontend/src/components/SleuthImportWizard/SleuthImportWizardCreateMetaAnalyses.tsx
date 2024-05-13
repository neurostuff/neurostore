import { Box } from '@mui/material';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import useGetProjectById from 'hooks/projects/useGetProjectById';
import { ISleuthFileUploadStubs } from './SleuthImportWizard.utils';

const SleuthImportWizardCreateMetaAnalyses: React.FC<{
    projectId: string;
    sleuthImports: ISleuthFileUploadStubs[];
}> = ({ projectId, sleuthImports }) => {
    const { data, isLoading, isError } = useGetProjectById('6SsLi3dPuTTa');

    return (
        <StateHandlerComponent isLoading={isLoading} isError={isError}>
            <Box>{}</Box>
        </StateHandlerComponent>
    );
};

export default SleuthImportWizardCreateMetaAnalyses;

import { Box, Typography } from '@mui/material';
import NavigationButtons, {
    ENavigationButton,
} from 'components/Buttons/NavigationButtons/NavigationButtons';
import ImportSelectorPopup from 'components/CurationComponents/SelectorPopups/ImportSelectorPopup/ImportSelectorPopup';
import { ICurationStubStudy, IImport, ISource } from 'interfaces/project/curation.interface';
import { useState } from 'react';
import { useProjectCurationImports } from 'stores/ProjectStore/getters';
import { useCreateNewCurationImport } from 'stores/ProjectStore/setters';

const CurationImportLabel: React.FC<{
    onNavigate: (button: ENavigationButton) => void;
    onUpdateStubs: (stubs: ICurationStubStudy[]) => void;
    stubs: ICurationStubStudy[];
    source: ISource | undefined;
}> = (props) => {
    const { onUpdateStubs, onNavigate, stubs, source } = props;
    const createImport = useCreateNewCurationImport();
    const imports = useProjectCurationImports();
    const [newImport, setNewImport] = useState<Partial<IImport>>();

    const handleAddImport = (anImport: Partial<IImport>) => {
        setNewImport(anImport);
    };

    const handleClearInput = () => {
        setNewImport(undefined);
    };

    const handleNavigate = (nav: ENavigationButton) => {
        if (nav === ENavigationButton.PREV) {
            onNavigate(nav);
            return;
        }

        if (!newImport?.name || !newImport?.id || !source) return;

        const importToCreate: IImport = {
            id: newImport.id,
            name: newImport.name,
            source: source,
        };

        if (!imports.some((x) => x.id === importToCreate.id)) {
            createImport(importToCreate);
        }

        onNavigate(nav);
    };

    return (
        <Box sx={{ paddingTop: '0.5rem' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
                <Box sx={{ width: '600px' }}>
                    <Typography gutterBottom sx={{ marginRight: '4px' }} variant="h6">
                        Give your import a name:{' '}
                        <span style={{ fontWeight: 'bold' }}>{newImport?.name || ''}</span>
                    </Typography>

                    <ImportSelectorPopup
                        size="medium"
                        label="import name"
                        placeholder="start typing or select from previous imports if they exist"
                        sx={{ margin: '1rem 0' }}
                        onSelectImport={handleAddImport}
                        onCreateImport={handleAddImport}
                        addOptionText="Set name as"
                        onClearInput={handleClearInput}
                    />
                </Box>
            </Box>
            <NavigationButtons
                nextButtonStyle="contained"
                nextButtonDisabled={!newImport?.name}
                onButtonClick={handleNavigate}
            />
        </Box>
    );
};

export default CurationImportLabel;

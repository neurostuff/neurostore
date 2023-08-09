import CurateStudies from 'components/CurationBeta/CurateStudies';
import CurationListItems, { ICurationListItem } from 'components/CurationBeta/CurationListItems';
import { IImport } from 'interfaces/project/curation.interface';
import { defaultExclusionTags, defaultIdentificationSources } from 'stores/ProjectStore/models';
import CurationLayout from './CurationLayout';

const CurationGenericInterface: React.FC = (props) => {
    const imports: IImport[] = [
        {
            id: 'a',
            name: 'WoS Import',
            source: defaultIdentificationSources.neurostore,
        },
        {
            id: 'b',
            name: 'RIS Import',
            source: defaultIdentificationSources.psycInfo,
        },
    ];

    const listItems: ICurationListItem[] = [];
    listItems.push({
        id: 'import-header',
        type: 'header',
        label: 'Imports',
        number: undefined,
    });

    const mappedItems = imports.map((anImport) => {
        return {
            id: anImport.id,
            type: 'listItem' as 'listItem' | 'header',
            label: anImport.name,
            number: 4,
        };
    });

    listItems.push(...mappedItems);
    listItems.push({
        id: 'exclusion-header',
        type: 'header',
        label: 'Exclusion Reasons',
        number: undefined,
    });
    listItems.push({
        id: defaultExclusionTags.duplicate.id,
        type: 'listItem',
        label: defaultExclusionTags.duplicate.label,
        number: 14,
    });

    return (
        <CurationLayout
            listItems={<CurationListItems listItems={listItems} />}
            mainInterface={<CurateStudies />}
        />
    );
};

export default CurationGenericInterface;

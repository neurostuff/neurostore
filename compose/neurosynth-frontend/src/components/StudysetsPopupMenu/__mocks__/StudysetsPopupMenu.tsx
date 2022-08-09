import { mockStudysets } from 'testing/mockData';
import { IStudysetsPopupMenu } from '../StudysetsPopupMenu';

const mockStudysetsPopupMenu: React.FC<IStudysetsPopupMenu> = (props) => {
    const studysets = mockStudysets();

    return (
        <>
            <button data-testid="add-studyset-button">mock add studyset</button>
            {studysets?.map((studyset, index) => (
                <span data-testid="child-studyset" key={studyset.id || index}>
                    child-mock-studyset
                </span>
            ))}
        </>
    );
};

export default mockStudysetsPopupMenu;

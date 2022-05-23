import { StudysetsApiResponse } from '../../../utils/api';
import { IStudysetsPopupMenu } from '../StudysetsPopupMenu';

const mockStudysetsPopupMenu: React.FC<IStudysetsPopupMenu> = (props) => {
    return (
        <>
            <button
                onClick={() => props.onCreateStudyset('test-name', 'test-description')}
                data-testid="add-studyset-button"
            >
                mock add studyset
            </button>
            <button
                onClick={() => {
                    if (props.studysets) {
                        props.onStudyAddedToStudyset(
                            props.study,
                            ((props.studysets as StudysetsApiResponse[]) || [])[0]
                        );
                    }
                }}
                data-testid="edit-studyset-button"
            >
                mock edit studyset
            </button>
            {props.studysets?.map((studyset, index) => (
                <span data-testid="child-studyset" key={studyset.id || index}>
                    child-mock-studyset
                </span>
            ))}
        </>
    );
};

export default mockStudysetsPopupMenu;

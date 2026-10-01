import { useAuth0 } from '@auth0/auth0-react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ICurationStubStudy } from 'pages/Curation/Curation.types';
import {
    useDemoteStub,
    useProjectCurationPrismaConfig,
    usePromoteStub,
    useSetExclusionForStub,
} from 'stores/projects/ProjectStore';
import { defaultExclusionTags, ENeurosynthTagIds } from 'stores/projects/ProjectStore.consts';
import { Mock, vi } from 'vitest';
import CurationEditableStubSummaryHeader from './CurationEditableStubSummaryHeader';

vi.mock('@auth0/auth0-react');
vi.mock('stores/projects/ProjectStore');
vi.mock('./CurationPopupExclusionSelector');

const promoteStub = vi.fn();
const setExclusionForStub = vi.fn();
const demoteStub = vi.fn();

const stub = { id: 'stub-1', exclusionTag: null } as ICurationStubStudy;

const renderHeader = ({
    type = 'default',
    columnIndex = 0,
    onMoveToNextStub = vi.fn(),
}: {
    type?: 'excluded' | 'included' | 'default';
    columnIndex?: number;
    onMoveToNextStub?: () => void;
} = {}) => {
    render(
        <CurationEditableStubSummaryHeader
            type={type}
            columnIndex={columnIndex}
            stub={stub}
            onMoveToNextStub={onMoveToNextStub}
        />
    );
    return onMoveToNextStub;
};

describe('CurationEditableStubSummaryHeader keyboard shortcuts', () => {
    beforeEach(() => {
        promoteStub.mockReset();
        setExclusionForStub.mockReset();
        demoteStub.mockReset();
        (useAuth0 as Mock).mockReturnValue({
            user: { sub: 'user-1' },
            isAuthenticated: true,
        });
        (usePromoteStub as Mock).mockReturnValue(promoteStub);
        (useSetExclusionForStub as Mock).mockReturnValue(setExclusionForStub);
        (useDemoteStub as Mock).mockReturnValue(demoteStub);
        (useProjectCurationPrismaConfig as Mock).mockReturnValue({ isPrisma: false });
    });

    it('promotes the study and moves to the next stub when a is pressed', async () => {
        const user = userEvent.setup();
        const onMoveToNextStub = renderHeader();

        await user.keyboard('a');

        expect(promoteStub).toHaveBeenCalledWith(0, 'stub-1');
        expect(onMoveToNextStub).toHaveBeenCalledTimes(1);
    });

    it('does not promote when the study is in the last column', async () => {
        const user = userEvent.setup();
        const onMoveToNextStub = renderHeader({ type: 'included', columnIndex: 2 });

        await user.keyboard('a');

        expect(promoteStub).not.toHaveBeenCalled();
        expect(onMoveToNextStub).not.toHaveBeenCalled();
    });

    it('excludes the study with the default tag and moves to the next stub when s is pressed', async () => {
        const user = userEvent.setup();
        const onMoveToNextStub = renderHeader();

        await user.keyboard('s');

        expect(setExclusionForStub).toHaveBeenCalledWith(0, 'stub-1', defaultExclusionTags.exclusion.id);
        expect(onMoveToNextStub).toHaveBeenCalledTimes(1);
    });

    it('uses the phase default exclusion tag', async () => {
        const user = userEvent.setup();
        (useProjectCurationPrismaConfig as Mock).mockReturnValue({ isPrisma: true });
        renderHeader({ columnIndex: 0 });

        await user.keyboard('s');

        expect(setExclusionForStub).toHaveBeenCalledWith(0, 'stub-1', ENeurosynthTagIds.DUPLICATE_EXCLUSION_ID);
    });

    it('demotes the study and moves to the next stub when d is pressed', async () => {
        const user = userEvent.setup();
        const onMoveToNextStub = renderHeader({ columnIndex: 1 });

        await user.keyboard('d');

        expect(demoteStub).toHaveBeenCalledWith(1, 'stub-1');
        expect(onMoveToNextStub).toHaveBeenCalledTimes(1);
    });

    it('demotes an included study in the last column when d is pressed', async () => {
        const user = userEvent.setup();
        const onMoveToNextStub = renderHeader({ type: 'included', columnIndex: 2 });

        await user.keyboard('d');

        expect(demoteStub).toHaveBeenCalledWith(2, 'stub-1');
        expect(onMoveToNextStub).toHaveBeenCalledTimes(1);
    });

    it('does not demote when the study is in the first column', async () => {
        const user = userEvent.setup();
        const onMoveToNextStub = renderHeader({ columnIndex: 0 });

        await user.keyboard('d');

        expect(demoteStub).not.toHaveBeenCalled();
        expect(onMoveToNextStub).not.toHaveBeenCalled();
    });

    it('does not promote, exclude, or demote an already excluded study', async () => {
        const user = userEvent.setup();
        renderHeader({ type: 'excluded', columnIndex: 1 });

        await user.keyboard('a');
        await user.keyboard('s');
        await user.keyboard('d');

        expect(promoteStub).not.toHaveBeenCalled();
        expect(setExclusionForStub).not.toHaveBeenCalled();
        expect(demoteStub).not.toHaveBeenCalled();
    });

    it('does not promote or exclude when an input is focused', async () => {
        const user = userEvent.setup();
        renderHeader();
        const input = document.createElement('input');
        document.body.appendChild(input);
        input.focus();

        await user.keyboard('a');
        await user.keyboard('s');

        expect(promoteStub).not.toHaveBeenCalled();
        expect(setExclusionForStub).not.toHaveBeenCalled();
        input.remove();
    });

    it('does not exclude again when the key is held down', () => {
        renderHeader();

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', repeat: true }));

        expect(setExclusionForStub).not.toHaveBeenCalled();
    });
});

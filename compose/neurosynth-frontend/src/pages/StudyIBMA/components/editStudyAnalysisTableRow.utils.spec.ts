import { shouldToggleStudyAnalysisRowExpansion } from 'pages/StudyIBMA/components/editStudyAnalysisTableRow.utils';
import type { MouseEvent } from 'react';

const mouseEventWithTarget = (target: EventTarget | null): Pick<MouseEvent, 'target'> => ({ target });

describe('shouldToggleStudyAnalysisRowExpansion', () => {
    it('returns true for non-interactive cell content', () => {
        const label = document.createElement('span');
        label.textContent = 'Contrast A';
        expect(shouldToggleStudyAnalysisRowExpansion(mouseEventWithTarget(label))).toBe(true);
    });

    it('returns false for button clicks', () => {
        const button = document.createElement('button');
        expect(shouldToggleStudyAnalysisRowExpansion(mouseEventWithTarget(button))).toBe(false);
    });

    it('returns false for clicks inside a dialog', () => {
        const dialog = document.createElement('div');
        dialog.setAttribute('role', 'dialog');
        const input = document.createElement('input');
        dialog.appendChild(input);
        document.body.appendChild(dialog);

        expect(shouldToggleStudyAnalysisRowExpansion(mouseEventWithTarget(input))).toBe(false);

        dialog.remove();
    });

    it('returns false for clicks inside a MUI modal root', () => {
        const modalRoot = document.createElement('div');
        modalRoot.className = 'MuiModal-root';
        const saveButton = document.createElement('button');
        modalRoot.appendChild(saveButton);
        document.body.appendChild(modalRoot);

        expect(shouldToggleStudyAnalysisRowExpansion(mouseEventWithTarget(saveButton))).toBe(false);

        modalRoot.remove();
    });

    it('returns false for menu item clicks', () => {
        const menuItem = document.createElement('li');
        menuItem.setAttribute('role', 'menuitem');
        expect(shouldToggleStudyAnalysisRowExpansion(mouseEventWithTarget(menuItem))).toBe(false);
    });
});

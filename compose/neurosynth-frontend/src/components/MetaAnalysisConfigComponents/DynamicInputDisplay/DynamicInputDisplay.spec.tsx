import { render, screen } from '@testing-library/react';
import { KWARG_STRING } from '..';
import DynamicInputDisplay from './DynamicInputDisplay';

describe('DynamicInputDisplay Component', () => {
    it('should render', () => {
        render(<DynamicInputDisplay dynamicArg={{}} />);

        expect(screen.queryByText('Optional arguments')).not.toBeInTheDocument();
        expect(screen.queryByText(KWARG_STRING)).not.toBeInTheDocument();
    });

    it('should render the optional arguments', () => {
        const dynamicArgs = {
            someStringKey: 'some test val',
            someNumericKey: 12345,
            someBooleanKey: true,
        };

        render(<DynamicInputDisplay dynamicArg={dynamicArgs} />);

        const title = screen.getByText('Arguments');
        expect(title).toBeInTheDocument();

        for (const [key, value] of Object.entries(dynamicArgs)) {
            expect(screen.getByText(key)).toBeInTheDocument();
            expect(screen.getByText(`${value}`)).toBeInTheDocument();
        }
    });

    it('should render the kwargs', () => {
        const dynamicArgs = {
            [KWARG_STRING]: {
                someStringKey1: 'some test val',
                someStringKey2: 'another test val',
            },
        };

        render(<DynamicInputDisplay dynamicArg={dynamicArgs} />);

        const title = screen.getByText(KWARG_STRING);
        expect(title).toBeInTheDocument();

        for (const [key, value] of Object.entries(dynamicArgs[KWARG_STRING])) {
            expect(screen.getByText(key)).toBeInTheDocument();
            expect(screen.getByText(value)).toBeInTheDocument();
        }
    });
});

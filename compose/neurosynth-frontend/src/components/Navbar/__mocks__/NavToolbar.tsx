import { INav } from 'components/Navbar/Navbar';

const mockNavToolbar = (props: INav) => {
    return (
        <div data-testid="mock-nav-toolbar">
            <button data-testid="toolbar-trigger-login" onClick={() => props.onLogin()}></button>
            <button data-testid="toolbar-trigger-logout" onClick={() => props.onLogout()}></button>
        </div>
    );
};

export default mockNavToolbar;

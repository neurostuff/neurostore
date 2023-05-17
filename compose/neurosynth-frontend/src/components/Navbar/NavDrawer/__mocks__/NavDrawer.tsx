import { INav } from 'components/Navbar/Navbar';

const mockNavDrawer: React.FC<INav> = (props) => {
    return (
        <div data-testid="mock-nav-drawer">
            <button data-testid="drawer-trigger-login" onClick={() => props.onLogin()}></button>
            <button data-testid="drawer-trigger-logout" onClick={() => props.onLogout()}></button>
        </div>
    );
};

export default mockNavDrawer;

const mockNavDrawer: React.FC<{ login: () => void; logout: () => void }> = (props) => {
    return (
        <div data-testid="mock-nav-drawer">
            <button data-testid="drawer-trigger-login" onClick={() => props.login()}></button>
            <button data-testid="drawer-trigger-logout" onClick={() => props.logout()}></button>
        </div>
    );
};

export default mockNavDrawer;

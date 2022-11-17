const mockNavToolbar: React.FC<{ login: () => void; logout: () => void }> = (props) => {
    return (
        <div data-testid="mock-nav-toolbar">
            <button data-testid="toolbar-trigger-login" onClick={() => props.login()}></button>
            <button data-testid="toolbar-trigger-logout" onClick={() => props.logout()}></button>
        </div>
    );
};

export default mockNavToolbar;

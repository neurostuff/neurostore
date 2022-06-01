import { NavbarArgs } from '../..';

const mockNavbarToolbar: React.FC<NavbarArgs> = (props) => {
    return (
        <div>
            <button onClick={props.login} data-testid="login">
                login
            </button>
            <button onClick={props.logout} data-testid="logout">
                logout
            </button>
        </div>
    );
};

export default mockNavbarToolbar;

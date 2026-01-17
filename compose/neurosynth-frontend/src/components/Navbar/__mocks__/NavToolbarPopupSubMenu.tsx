import { INavToolbarPopupSubMenu } from 'components/Navbar/NavToolbarPopupSubMenu';
import React from 'react';
import { useState } from 'react';

const MockNavToolbarPopupSubMenu: React.FC<INavToolbarPopupSubMenu> = (props) => {
    const [showPopup, setShowPopup] = useState(false);

    return (
        <>
            <span>{props.buttonLabel}</span>
            <button onClick={() => setShowPopup(true)} data-testid="mock-trigger-show-popup"></button>
            <button onClick={() => setShowPopup(false)} data-testid="mock-trigger-hide-popup"></button>
            <ul>
                {showPopup &&
                    props.options.map((option, index) => (
                        <React.Fragment key={index}>
                            <li>{option.label}</li>
                            <li>{option.secondary}</li>
                        </React.Fragment>
                    ))}
            </ul>
        </>
    );
};

export default MockNavToolbarPopupSubMenu;

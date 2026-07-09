import { INeurosynthPopper } from '../NeurosynthPopper';

// already tested child component
const MockNeurosynthPopper: React.FC<INeurosynthPopper> = (props: any) => {
    return (
        <>
            <button onClick={props.onClickAway as any} data-testid="trigger-click-away">
                trigger click away
            </button>
            <div data-testid={props.open ? 'mock-popper-open' : 'mock-popper-closed'}>{(props as any).children}</div>
        </>
    );
};

export default MockNeurosynthPopper;

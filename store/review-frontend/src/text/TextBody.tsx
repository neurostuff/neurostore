import { Fragment, memo, type ComponentType, type ReactNode } from 'react';
import type { Block, TableBlock } from './layout';

/** What is set beside a block, or after the text when `block` is null; it renders itself, so the text never re-renders. */
export type Aside = ComponentType<{ block: Block | null }>;

interface TextBodyProps {
    text: string;
    blocks: Block[];
    aside?: Aside;
}

function Trail({ text }: { text: string }) {
    return text ? <span className="rv-trail">{text}</span> : null;
}

function Table({ text, block }: { text: string; block: TableBlock }) {
    return (
        <table className="rv-table" data-table-id={block.tableId} data-start={block.start}>
            <tbody>
                {block.rows.map((row) => (
                    <tr key={row.start}>
                        {row.cells.map((cell) => (
                            <td key={cell.start}>
                                {text.slice(cell.start, cell.contentEnd)}
                                <Trail text={text.slice(cell.contentEnd, cell.end)} />
                            </td>
                        ))}
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function renderBlock(text: string, block: Block): ReactNode {
    const trail = <Trail text={text.slice(block.contentEnd, block.end)} />;
    switch (block.kind) {
        case 'heading': {
            const Heading = `h${Math.min(block.level, 6)}` as 'h1';
            return (
                <Heading key={block.start} className="rv-heading" data-start={block.start}>
                    {block.markerEnd > block.start && (
                        <span className="rv-marker">{text.slice(block.start, block.markerEnd)}</span>
                    )}
                    {text.slice(block.markerEnd, block.contentEnd)}
                    {trail}
                </Heading>
            );
        }
        case 'table':
            return <Table key={block.start} text={text} block={block} />;
        case 'paragraph':
            return (
                <p key={block.start} className="rv-paragraph" data-start={block.start}>
                    {text.slice(block.start, block.contentEnd)}
                    {trail}
                </p>
            );
    }
}

export const TextBody = memo(function TextBody({ text, blocks, aside: Beside }: TextBodyProps) {
    return (
        <div className="rv-text">
            {blocks.map((block) => (
                <Fragment key={block.start}>
                    {renderBlock(text, block)}
                    {Beside && <Beside block={block} />}
                </Fragment>
            ))}
            {Beside && <Beside block={null} />}
        </div>
    );
});

import { ExpandMoreOutlined } from '@mui/icons-material';
import { Accordion, AccordionDetails, AccordionSummary } from '@mui/material';
import { SystemStyleObject } from '@mui/system';

interface INeurosynthAccordion {
    defaultExpanded?: boolean;
    elevation?: number;
    sx?: SystemStyleObject;
    accordionSummarySx?: SystemStyleObject;
    accordionDetailsSx?: SystemStyleObject;
    TitleElement?: JSX.Element;
}

const NeurosynthAccordion: React.FC<INeurosynthAccordion> = (props) => {
    const {
        defaultExpanded = false,
        elevation = 1,
        sx = {},
        accordionSummarySx = {},
        accordionDetailsSx = {},
        TitleElement = <b></b>,
    } = props;

    return (
        <Accordion sx={sx} defaultExpanded={defaultExpanded} elevation={elevation}>
            <AccordionSummary sx={accordionSummarySx} expandIcon={<ExpandMoreOutlined />}>
                {TitleElement}
            </AccordionSummary>
            <AccordionDetails sx={accordionDetailsSx}>{props.children}</AccordionDetails>
        </Accordion>
    );
};

export default NeurosynthAccordion;

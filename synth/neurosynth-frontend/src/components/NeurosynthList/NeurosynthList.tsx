import {
    Paper,
    Typography,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Box,
} from '@mui/material';
import { SystemStyleObject } from '@mui/system';
import StateHandlerComponent from 'components/StateHandlerComponent/StateHandlerComponent';
import { useHistory } from 'react-router-dom';

interface INeurosynthList {
    listIcon?: JSX.Element;
    titleText?: string;
    listItems: {
        primaryText: string;
        secondaryText: string;
        link: string;
        id: string;
    }[];
    containerSx?: SystemStyleObject;
    isLoading?: boolean;
    isError?: boolean;
    loaderColor?: string;
    NoDataElement?: JSX.Element;
    TitleButton?: JSX.Element;
}

const NeurosynthList: React.FC<INeurosynthList> = (props) => {
    const history = useHistory();

    const {
        isLoading = false,
        isError = false,
        loaderColor = 'primary.main',
        NoDataElement = <>no data</>,
        TitleButton = undefined,
    } = props;

    const handleNavigate = (link: string) => {
        history.push(link);
    };

    return (
        <Paper
            variant="outlined"
            sx={{
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                ...props.containerSx,
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1rem',
                }}
            >
                <Typography sx={{ display: 'block' }} variant="h6" color="primary.contrastText">
                    {props.titleText}
                </Typography>
                {props.TitleButton && props.TitleButton}
            </Box>
            <StateHandlerComponent
                loadingColor={loaderColor}
                isError={isError}
                isLoading={isLoading}
            >
                {props.listItems.length === 0 ? (
                    NoDataElement
                ) : (
                    <List
                        sx={{
                            overflow: 'auto',
                            height: '100%',
                            backgroundColor: 'background.paper',
                        }}
                    >
                        {props.listItems.map((listItem, index) => (
                            <ListItem key={listItem?.id || index} disablePadding>
                                <ListItemButton onClick={() => handleNavigate(listItem.link)}>
                                    {props.listIcon && (
                                        <ListItemIcon>{props.listIcon}</ListItemIcon>
                                    )}
                                    <ListItemText
                                        primary={listItem.primaryText}
                                        secondary={listItem.secondaryText}
                                    ></ListItemText>
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>
                )}
            </StateHandlerComponent>
        </Paper>
    );
};

export default NeurosynthList;

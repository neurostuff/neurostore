const useSnackbar = () => {
    return {
        enqueueSnackbar: jest.fn(),
    };
};

export { useSnackbar };

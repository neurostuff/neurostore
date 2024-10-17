const useSnackbar = jest.fn().mockReturnValue({
    enqueueSnackbar: jest.fn(),
});

export { useSnackbar };

const useNavigate = jest.fn().mockReturnValue(jest.fn());

const useLocation = jest.fn().mockReturnValue({
    location: {
        search: '',
    },
});

export { useNavigate, useLocation };

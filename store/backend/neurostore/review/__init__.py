"""The review core: a reviewer's typed ops applied to one paper's study_schema documents."""


class ReviewError(ValueError):
    """An op or a path the review core cannot apply; ``problems`` names each problem."""

    def __init__(self, message, problems=None):
        super().__init__(message)
        self.problems = problems or [message]

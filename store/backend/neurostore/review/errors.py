"""The errors a review request can end in; the API and the CLI each map them in one place."""


class ReviewError(ValueError):
    """A request the review cannot carry out; ``problems`` names each problem.

    ``errors`` holds the entries a response lists, if any: ErrorDetails or the dicts of their
    fields. They are opaque to the core, which only passes them on.
    """

    def __init__(self, message, problems=None, *, errors=None):
        super().__init__(message)
        self.problems = problems or [message]
        self.errors = errors


class NotFound(ReviewError):
    """``NotFound(resource, id)``: the ``resource`` kind and the ``id`` that matched none."""

    def __init__(self, resource, id):
        super().__init__(f"{resource} {id} not found")
        self.resource = resource
        self.id = id


class Conflict(ReviewError):
    """``last_seq`` is the review's last stored op, for a batch made against an older one."""

    def __init__(self, message, *, errors=None, last_seq=None):
        super().__init__(message, errors=errors)
        self.last_seq = last_seq


class Refused(ReviewError):
    """The caller may not do this."""


class Unprocessable(ReviewError):
    pass

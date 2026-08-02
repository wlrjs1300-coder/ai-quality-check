class ErrorCodeError(ValueError):
    code: str
    status_code: int
    details: dict | None

    def __init__(self, code: str, message: str, status_code: int = 400, details: dict | None = None) -> None:
        super().__init__(message)
        self.code = code
        self.status_code = status_code
        self.details = details

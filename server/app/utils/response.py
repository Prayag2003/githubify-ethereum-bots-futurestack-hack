from fastapi.responses import JSONResponse

class StandardResponse:
    """Helper to standardize API success/error responses."""

    @staticmethod
    def success(data: dict = None, message: str = "Success", code: int = 200):
        return JSONResponse(
            status_code=code,
            content={
                "status": "success",
                "message": message,
                "data": data
            }
        )

    @staticmethod
    def error(message: str = "Error occurred", code: int = 400, data: dict = None):
        return JSONResponse(
            status_code=code,
            content={
                "status": "error",
                "message": message,
                "data": data
            }
        )

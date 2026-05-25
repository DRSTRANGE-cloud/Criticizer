from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.db import users_collection
from app.utils.security import JWTError, decode_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        user_id: str | None = payload.get("sub")
        if not user_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = users_collection.find_one({"user_id": user_id})
    if not user:
        raise credentials_exception
    return user


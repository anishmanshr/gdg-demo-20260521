from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse, AuthUserResponse
from app.schemas.user import UserResponse
from app.services.auth_service import register_user, login_user
from app.utils.dependencies import get_current_user
from app.models.user import User

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthUserResponse, status_code=201)
async def register(req: RegisterRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    user = await register_user(db, req.name, req.email, req.password, req.role)
    from app.utils.security import create_access_token
    token = create_access_token(data={"sub": str(user.id), "role": user.role.value})
    return {
        "id": user.id, "name": user.name, "email": user.email,
        "role": user.role.value, "access_token": token, "token_type": "bearer",
    }


@router.post("/login", response_model=AuthUserResponse)
async def login(req: LoginRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    return await login_user(db, req.email, req.password)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: Annotated[User, Depends(get_current_user)]):
    return current_user

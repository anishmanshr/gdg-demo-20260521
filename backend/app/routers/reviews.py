from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.schemas.review import ReviewCreate, ReviewResponse
from app.utils.dependencies import get_current_user
from app.models.user import User
from app.models.booking import Booking, BookingStatus
from app.models.review import Review

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.post("", response_model=ReviewResponse, status_code=201)
async def create_review(
    data: ReviewCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    booking_result = await db.execute(
        select(Booking).where(
            Booking.id == data.booking_id,
            Booking.user_id == current_user.id,
            Booking.property_id == data.property_id,
        )
    )
    booking = booking_result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Booking not found")
    if booking.status != BookingStatus.completed:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Can only review completed bookings")

    existing = await db.execute(
        select(Review).where(Review.booking_id == data.booking_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Booking already reviewed")

    review = Review(
        user_id=current_user.id,
        property_id=data.property_id,
        booking_id=data.booking_id,
        rating=data.rating,
        comment=data.comment,
    )
    db.add(review)
    await db.commit()
    await db.refresh(review)

    return {
        "id": review.id, "user_id": review.user_id,
        "property_id": review.property_id, "booking_id": review.booking_id,
        "rating": review.rating, "comment": review.comment,
        "created_at": review.created_at, "user_name": current_user.name,
    }

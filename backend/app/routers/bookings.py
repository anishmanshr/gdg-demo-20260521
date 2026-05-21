from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.schemas.booking import BookingCreate, BookingResponse, BookingDetailResponse
from app.services.booking_service import create_booking, cancel_booking
from app.utils.dependencies import get_current_user, require_host
from app.models.user import User
from app.models.booking import Booking, BookingStatus
from app.models.property import Property
from fastapi import HTTPException, status

router = APIRouter(prefix="/bookings", tags=["bookings"])


@router.post("", response_model=BookingDetailResponse, status_code=201)
async def new_booking(
    data: BookingCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    booking = await create_booking(db, current_user.id, data.property_id, data.check_in, data.check_out, data.guests)
    return _build_booking_detail(booking)


@router.get("/me", response_model=list[BookingDetailResponse])
async def my_bookings(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(
        select(Booking)
        .where(Booking.user_id == current_user.id)
        .order_by(Booking.created_at.desc())
    )
    bookings = result.scalars().all()
    return [_build_booking_detail(b) for b in bookings]


@router.get("/host", response_model=list[BookingDetailResponse])
async def host_bookings(
    current_user: Annotated[User, Depends(require_host)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    host_properties = await db.execute(select(Property.id).where(Property.host_id == current_user.id))
    property_ids = [row[0] for row in host_properties.fetchall()]
    if not property_ids:
        return []

    result = await db.execute(
        select(Booking)
        .where(Booking.property_id.in_(property_ids))
        .order_by(Booking.created_at.desc())
    )
    bookings = result.scalars().all()
    return [_build_booking_detail(b) for b in bookings]


@router.patch("/{booking_id}/cancel", response_model=BookingDetailResponse)
async def cancel(
    booking_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    booking = await cancel_booking(db, booking_id, current_user.id)
    return _build_booking_detail(booking)


def _build_booking_detail(booking: Booking) -> dict:
    return {
        "id": booking.id,
        "user_id": booking.user_id,
        "property_id": booking.property_id,
        "check_in": booking.check_in,
        "check_out": booking.check_out,
        "guests": booking.guests,
        "total_price": booking.total_price,
        "status": booking.status.value if hasattr(booking.status, "value") else booking.status,
        "created_at": booking.created_at,
        "updated_at": booking.updated_at,
        "property_title": booking.property.title if booking.property else None,
        "property_location": booking.property.location if booking.property else None,
        "user_name": booking.user.name if booking.user else None,
        "user_email": booking.user.email if booking.user else None,
    }

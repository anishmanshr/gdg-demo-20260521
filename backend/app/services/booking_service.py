from datetime import datetime
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status
from app.models.booking import Booking, BookingStatus
from app.models.property import Property


async def create_booking(
    db: AsyncSession,
    user_id: int,
    property_id: int,
    check_in: datetime,
    check_out: datetime,
    guests: int,
) -> Booking:
    if check_out <= check_in:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Check-out must be after check-in")

    result = await db.execute(select(Property).where(Property.id == property_id))
    property = result.scalar_one_or_none()
    if not property or not property.is_active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")

    if property.host_id == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot book your own property")

    if guests > property.max_guests:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Property allows max {property.max_guests} guests")

    overlap_query = select(Booking).where(
        Booking.property_id == property_id,
        Booking.status.in_([BookingStatus.confirmed, BookingStatus.pending]),
        Booking.check_in < check_out,
        Booking.check_out > check_in,
    )
    overlap_result = await db.execute(overlap_query)
    if overlap_result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Property is not available for selected dates")

    nights = (check_out - check_in).days
    total_price = nights * property.price_per_night

    booking = Booking(
        user_id=user_id,
        property_id=property_id,
        check_in=check_in,
        check_out=check_out,
        guests=guests,
        total_price=total_price,
        status=BookingStatus.confirmed,
    )
    db.add(booking)
    await db.commit()
    await db.refresh(booking)
    return booking


async def cancel_booking(db: AsyncSession, booking_id: int, user_id: int) -> Booking:
    result = await db.execute(select(Booking).where(Booking.id == booking_id))
    booking = result.scalar_one_or_none()
    if not booking:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found")
    if booking.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your booking")
    if booking.status in (BookingStatus.cancelled, BookingStatus.completed):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot cancel this booking")
    booking.status = BookingStatus.cancelled
    await db.commit()
    await db.refresh(booking)
    return booking

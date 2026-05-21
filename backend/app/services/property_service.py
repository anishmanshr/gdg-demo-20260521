from datetime import datetime
from typing import Optional
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload
from app.models.property import Property, PropertyImage
from app.models.amenity import Amenity, PropertyAmenity
from app.models.booking import Booking, BookingStatus
from app.models.review import Review


async def search_properties(
    db: AsyncSession,
    location: Optional[str] = None,
    check_in: Optional[datetime] = None,
    check_out: Optional[datetime] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    guests: Optional[int] = None,
    property_type: Optional[str] = None,
    amenity_ids: Optional[list[int]] = None,
    host_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 20,
) -> tuple[list[Property], int]:
    query = select(Property).where(Property.is_active == True)

    if host_id is not None:
        query = query.where(Property.host_id == host_id)
    if location:
        query = query.where(Property.location.ilike(f"%{location}%"))
    if min_price is not None:
        query = query.where(Property.price_per_night >= min_price)
    if max_price is not None:
        query = query.where(Property.price_per_night <= max_price)
    if guests is not None:
        query = query.where(Property.max_guests >= guests)
    if property_type:
        query = query.where(Property.property_type == property_type)

    if amenity_ids:
        query = query.where(
            Property.id.in_(
                select(PropertyAmenity.property_id).where(PropertyAmenity.amenity_id.in_(amenity_ids))
            )
        )

    if check_in and check_out:
        overlapping_property_ids = select(Booking.property_id).where(
            Booking.status.in_([BookingStatus.confirmed, BookingStatus.pending]),
            Booking.check_in < check_out,
            Booking.check_out > check_in,
        )
        query = query.where(Property.id.not_in(overlapping_property_ids))

    count_query = select(func.count()).select_from(query.subquery())
    count_result = await db.execute(count_query)
    total = count_result.scalar() or 0

    query = query.options(
        joinedload(Property.images),
        joinedload(Property.amenities).joinedload(PropertyAmenity.amenity),
    ).order_by(Property.created_at.desc()).offset(skip).limit(limit)

    result = await db.execute(query)
    properties = result.unique().scalars().all()

    return properties, total


async def get_property_with_details(db: AsyncSession, property_id: int) -> Optional[Property]:
    result = await db.execute(
        select(Property)
        .options(
            joinedload(Property.host),
            joinedload(Property.images),
            joinedload(Property.amenities).joinedload(PropertyAmenity.amenity),
        )
        .where(Property.id == property_id)
    )
    return result.unique().scalar_one_or_none()


async def get_average_rating(db: AsyncSession, property_id: int) -> Optional[float]:
    result = await db.execute(
        select(func.avg(Review.rating)).where(Review.property_id == property_id)
    )
    avg = result.scalar()
    return round(float(avg), 1) if avg else None


async def create_property(db: AsyncSession, host_id: int, property_data: dict) -> Property:
    amenity_ids = property_data.pop("amenities", [])
    image_urls = property_data.pop("images", [])

    prop = Property(host_id=host_id, **property_data)
    db.add(prop)
    await db.flush()

    for img_url in image_urls:
        db.add(PropertyImage(property_id=prop.id, image_url=img_url))

    for amenity_id in amenity_ids:
        db.add(PropertyAmenity(property_id=prop.id, amenity_id=amenity_id))

    await db.commit()
    await db.refresh(prop)
    return await get_property_with_details(db, prop.id)


async def update_property(db: AsyncSession, prop: Property, property_data: dict) -> Property:
    amenity_ids = property_data.pop("amenities", None)
    image_urls = property_data.pop("images", None)

    for key, value in property_data.items():
        if value is not None:
            setattr(prop, key, value)

    if image_urls is not None:
        existing_images = (await db.execute(
            select(PropertyImage).where(PropertyImage.property_id == prop.id)
        )).scalars().all()
        for img in existing_images:
            await db.delete(img)
        for img_url in image_urls:
            db.add(PropertyImage(property_id=prop.id, image_url=img_url))

    if amenity_ids is not None:
        existing_links = (await db.execute(
            select(PropertyAmenity).where(PropertyAmenity.property_id == prop.id)
        )).scalars().all()
        for link in existing_links:
            await db.delete(link)
        for amenity_id in amenity_ids:
            db.add(PropertyAmenity(property_id=prop.id, amenity_id=amenity_id))

    await db.commit()
    await db.refresh(prop)
    return await get_property_with_details(db, prop.id)

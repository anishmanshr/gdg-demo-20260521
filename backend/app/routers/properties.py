from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.schemas.property import PropertyCreate, PropertyUpdate, PropertyResponse, PropertyListResponse
from app.schemas.review import ReviewResponse
from app.services.property_service import (
    search_properties, get_property_with_details, get_average_rating,
    create_property, update_property,
)
from app.utils.dependencies import get_current_user, require_host
from app.models.user import User
from app.models.property import Property
from app.models.review import Review
from sqlalchemy import select
from fastapi import HTTPException, status
from datetime import datetime

router = APIRouter(prefix="/properties", tags=["properties"])


@router.get("", response_model=dict)
async def list_properties(
    db: Annotated[AsyncSession, Depends(get_db)],
    location: Optional[str] = Query(None),
    check_in: Optional[datetime] = Query(None),
    check_out: Optional[datetime] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    guests: Optional[int] = Query(None),
    property_type: Optional[str] = Query(None),
    host_id: Optional[int] = Query(None),
    amenities: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    amenity_ids = None
    if amenities:
        amenity_ids = [int(a) for a in amenities.split(",") if a.strip().isdigit()]

    props, total = await search_properties(
        db, location=location, check_in=check_in, check_out=check_out,
        min_price=min_price, max_price=max_price, guests=guests,
        property_type=property_type, amenity_ids=amenity_ids,
        host_id=host_id,
        skip=skip, limit=limit,
    )

    items = []
    for p in props:
        first_image = p.images[0].image_url if p.images else None
        avg_rating = await get_average_rating(db, p.id)
        items.append({
            "id": p.id, "host_id": p.host_id, "title": p.title,
            "location": p.location, "price_per_night": p.price_per_night,
            "max_guests": p.max_guests, "bedrooms": p.bedrooms,
            "bathrooms": p.bathrooms, "property_type": p.property_type,
            "first_image": first_image, "average_rating": avg_rating,
        })

    return {"items": items, "total": total, "skip": skip, "limit": limit}


@router.get("/{property_id}", response_model=PropertyResponse)
async def get_property(property_id: int, db: Annotated[AsyncSession, Depends(get_db)]):
    prop = await get_property_with_details(db, property_id)
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    avg_rating = await get_average_rating(db, property_id)

    images = [{"id": img.id, "image_url": img.image_url} for img in prop.images]
    amenity_list = []
    for pa in prop.amenities:
        amenity_list.append({"id": pa.amenity.id, "name": pa.amenity.name})

    return {
        "id": prop.id, "host_id": prop.host_id, "title": prop.title,
        "description": prop.description, "location": prop.location,
        "price_per_night": prop.price_per_night, "max_guests": prop.max_guests,
        "bedrooms": prop.bedrooms, "bathrooms": prop.bathrooms,
        "property_type": prop.property_type, "is_active": prop.is_active,
        "created_at": prop.created_at, "updated_at": prop.updated_at,
        "images": images, "amenities": amenity_list, "average_rating": avg_rating,
    }


@router.post("", response_model=PropertyResponse, status_code=201)
async def create_listing(
    data: PropertyCreate,
    current_user: Annotated[User, Depends(require_host)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    prop = await create_property(
        db, current_user.id,
        {
            "title": data.title, "description": data.description,
            "location": data.location, "price_per_night": data.price_per_night,
            "max_guests": data.max_guests, "bedrooms": data.bedrooms,
            "bathrooms": data.bathrooms, "property_type": data.property_type,
            "amenities": data.amenities, "images": data.images,
        },
    )
    return await _build_property_response(prop, db)


@router.put("/{property_id}", response_model=PropertyResponse)
async def update_listing(
    property_id: int, data: PropertyUpdate,
    current_user: Annotated[User, Depends(require_host)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Property).where(Property.id == property_id))
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    if prop.host_id != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your property")

    update_dict = data.model_dump(exclude_unset=True)
    prop = await update_property(db, prop, update_dict)
    return await _build_property_response(prop, db)


@router.delete("/{property_id}", status_code=204)
async def delete_listing(
    property_id: int,
    current_user: Annotated[User, Depends(require_host)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    result = await db.execute(select(Property).where(Property.id == property_id))
    prop = result.scalar_one_or_none()
    if not prop:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Property not found")
    if prop.host_id != current_user.id and current_user.role.value != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not your property")
    await db.delete(prop)
    await db.commit()


@router.get("/{property_id}/reviews", response_model=list[ReviewResponse])
async def get_property_reviews(property_id: int, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(
        select(Review).where(Review.property_id == property_id).order_by(Review.created_at.desc())
    )
    reviews = result.scalars().all()
    items = []
    for r in reviews:
        items.append({
            "id": r.id, "user_id": r.user_id, "property_id": r.property_id,
            "booking_id": r.booking_id, "rating": r.rating, "comment": r.comment,
            "created_at": r.created_at, "user_name": r.user.name,
        })
    return items


async def _build_property_response(prop, db):
    avg_rating = await get_average_rating(db, prop.id)
    images = [{"id": img.id, "image_url": img.image_url} for img in prop.images]
    amenity_list = []
    for pa in prop.amenities:
        amenity_list.append({"id": pa.amenity.id, "name": pa.amenity.name})
    return {
        "id": prop.id, "host_id": prop.host_id, "title": prop.title,
        "description": prop.description, "location": prop.location,
        "price_per_night": prop.price_per_night, "max_guests": prop.max_guests,
        "bedrooms": prop.bedrooms, "bathrooms": prop.bathrooms,
        "property_type": prop.property_type, "is_active": prop.is_active,
        "created_at": prop.created_at, "updated_at": prop.updated_at,
        "images": images, "amenities": amenity_list, "average_rating": avg_rating,
    }

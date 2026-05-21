from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class PropertyImageSchema(BaseModel):
    id: Optional[int] = None
    image_url: str

    model_config = {"from_attributes": True}


class AmenitySchema(BaseModel):
    id: Optional[int] = None
    name: str

    model_config = {"from_attributes": True}


class PropertyCreate(BaseModel):
    title: str
    description: Optional[str] = None
    location: str
    price_per_night: float = Field(gt=0)
    max_guests: int = Field(gt=0)
    bedrooms: int = Field(ge=0)
    bathrooms: int = Field(ge=0)
    property_type: str = "apartment"
    amenities: list[int] = []
    images: list[str] = []


class PropertyUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    price_per_night: Optional[float] = Field(default=None, gt=0)
    max_guests: Optional[int] = Field(default=None, gt=0)
    bedrooms: Optional[int] = Field(default=None, ge=0)
    bathrooms: Optional[int] = Field(default=None, ge=0)
    property_type: Optional[str] = None
    amenities: Optional[list[int]] = None
    images: Optional[list[str]] = None
    is_active: Optional[bool] = None


class PropertyResponse(BaseModel):
    id: int
    host_id: int
    title: str
    description: Optional[str] = None
    location: str
    price_per_night: float
    max_guests: int
    bedrooms: int
    bathrooms: int
    property_type: str
    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None
    images: list[PropertyImageSchema] = []
    amenities: list[AmenitySchema] = []
    average_rating: Optional[float] = None

    model_config = {"from_attributes": True}


class PropertyListResponse(BaseModel):
    id: int
    host_id: int
    title: str
    location: str
    price_per_night: float
    max_guests: int
    bedrooms: int
    bathrooms: int
    property_type: str
    first_image: Optional[str] = None
    average_rating: Optional[float] = None

    model_config = {"from_attributes": True}


class PropertySearchFilters(BaseModel):
    location: Optional[str] = None
    check_in: Optional[datetime] = None
    check_out: Optional[datetime] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    guests: Optional[int] = None
    property_type: Optional[str] = None
    amenities: Optional[list[int]] = None
    skip: int = 0
    limit: int = 20

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class BookingCreate(BaseModel):
    property_id: int
    check_in: datetime
    check_out: datetime
    guests: int = Field(gt=0)


class BookingResponse(BaseModel):
    id: int
    user_id: int
    property_id: int
    check_in: datetime
    check_out: datetime
    guests: int
    total_price: float
    status: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class BookingDetailResponse(BookingResponse):
    property_title: Optional[str] = None
    property_location: Optional[str] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None

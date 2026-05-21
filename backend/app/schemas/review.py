from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class ReviewCreate(BaseModel):
    property_id: int
    booking_id: int
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = None


class ReviewResponse(BaseModel):
    id: int
    user_id: int
    property_id: int
    booking_id: int
    rating: int
    comment: Optional[str] = None
    created_at: datetime
    user_name: Optional[str] = None

    model_config = {"from_attributes": True}

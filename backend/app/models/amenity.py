from sqlalchemy import Column, Integer, String, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Amenity(Base):
    __tablename__ = "amenities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)

    property_links = relationship("PropertyAmenity", back_populates="amenity")


class PropertyAmenity(Base):
    __tablename__ = "property_amenities"

    property_id = Column(Integer, ForeignKey("properties.id"), primary_key=True)
    amenity_id = Column(Integer, ForeignKey("amenities.id"), primary_key=True)

    property = relationship("Property", back_populates="amenities")
    amenity = relationship("Amenity", back_populates="property_links", lazy="joined")

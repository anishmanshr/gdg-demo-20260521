import asyncio
import sys
from datetime import datetime, timedelta
sys.path.insert(0, ".")
from app.database import async_session
from app.models.user import User, UserRole
from app.models.property import Property, PropertyImage
from app.utils.security import hash_password
from sqlalchemy import select


SEED_PROPERTIES = [
    {
        "title": "Cozy Apartment in Kathmandu",
        "description": "A beautiful apartment in the heart of Thamel with stunning city views. Walking distance to Durbar Square and local markets.",
        "location": "Kathmandu",
        "price_per_night": 45.00,
        "max_guests": 2,
        "bedrooms": 1,
        "bathrooms": 1,
        "property_type": "apartment",
        "images": ["https://picsum.photos/seed/kathmandu1/800/600", "https://picsum.photos/seed/kathmandu2/800/600"],
    },
    {
        "title": "Lakeside Villa Pokhara",
        "description": "Luxurious villa with panoramic Fewa Lake views. Private garden, terrace, and mountain backdrop.",
        "location": "Pokhara",
        "price_per_night": 120.00,
        "max_guests": 6,
        "bedrooms": 3,
        "bathrooms": 2,
        "property_type": "villa",
        "images": ["https://picsum.photos/seed/pokhara1/800/600", "https://picsum.photos/seed/pokhara2/800/600"],
    },
    {
        "title": "Mountain Cabin Nagarkot",
        "description": "Rustic wooden cabin perched on a hilltop with 360-degree Himalayan sunrise views. Perfect retreat for nature lovers.",
        "location": "Nagarkot",
        "price_per_night": 85.00,
        "max_guests": 4,
        "bedrooms": 2,
        "bathrooms": 1,
        "property_type": "cabin",
        "images": ["https://picsum.photos/seed/nagarkot1/800/600"],
    },
    {
        "title": "Modern Studio in Patan",
        "description": "Sleek studio apartment in the historic Patan Durbar area. Surrounded by temples, cafes, and artisan workshops.",
        "location": "Lalitpur",
        "price_per_night": 35.00,
        "max_guests": 2,
        "bedrooms": 1,
        "bathrooms": 1,
        "property_type": "apartment",
        "images": ["https://picsum.photos/seed/patan1/800/600", "https://picsum.photos/seed/patan2/800/600"],
    },
    {
        "title": "Heritage Home Bhaktapur",
        "description": "Restored Newari heritage house with traditional courtyard. Experience authentic culture in a UNESCO World Heritage city.",
        "location": "Bhaktapur",
        "price_per_night": 65.00,
        "max_guests": 4,
        "bedrooms": 2,
        "bathrooms": 2,
        "property_type": "house",
        "images": ["https://picsum.photos/seed/bhaktapur1/800/600"],
    },
    {
        "title": "Riverside Cottage Chitwan",
        "description": "Charming cottage along the Rapti River. Wake up to birdsong, go on jungle safaris, and spot rhinos and tigers.",
        "location": "Chitwan",
        "price_per_night": 55.00,
        "max_guests": 3,
        "bedrooms": 1,
        "bathrooms": 1,
        "property_type": "cabin",
        "images": ["https://picsum.photos/seed/chitwan1/800/600", "https://picsum.photos/seed/chitwan2/800/600"],
    },
    {
        "title": "Penthouse Suite Thamel",
        "description": "Top-floor penthouse with rooftop jacuzzi and bar. The ultimate urban escape in Kathmandu's liveliest district.",
        "location": "Kathmandu",
        "price_per_night": 150.00,
        "max_guests": 4,
        "bedrooms": 2,
        "bathrooms": 2,
        "property_type": "condo",
        "images": ["https://picsum.photos/seed/thamel1/800/600"],
    },
    {
        "title": "Buddha Garden Retreat",
        "description": "Peaceful garden retreat near Swayambhunath Stupa. Meditation space, organic garden, and vegetarian breakfast included.",
        "location": "Kathmandu",
        "price_per_night": 40.00,
        "max_guests": 3,
        "bedrooms": 1,
        "bathrooms": 1,
        "property_type": "house",
        "images": ["https://picsum.photos/seed/buddha1/800/600", "https://picsum.photos/seed/buddha2/800/600"],
    },
    {
        "title": "Luxury Lake House Begnas",
        "description": "Stunning lakefront property on Begnas Lake. Private dock, kayaks, and spectacular Annapurna range views.",
        "location": "Pokhara",
        "price_per_night": 200.00,
        "max_guests": 8,
        "bedrooms": 4,
        "bathrooms": 3,
        "property_type": "villa",
        "images": ["https://picsum.photos/seed/begnas1/800/600", "https://picsum.photos/seed/begnas2/800/600"],
    },
    {
        "title": "Budget Room Boudha",
        "description": "Simple, clean room near Boudhanath Stupa. Ideal for backpackers and spiritual seekers. Rooftop with stupa view.",
        "location": "Kathmandu",
        "price_per_night": 15.00,
        "max_guests": 2,
        "bedrooms": 1,
        "bathrooms": 1,
        "property_type": "apartment",
        "images": ["https://picsum.photos/seed/boudha1/800/600"],
    },
]


async def seed():
    async with async_session() as db:
        result = await db.execute(select(User).where(User.role == UserRole.host, User.email == "host@example.com"))
        host = result.scalar_one_or_none()

        if not host:
            host = User(
                name="Demo Host",
                email="host@example.com",
                password_hash=hash_password("host123"),
                role=UserRole.host,
            )
            db.add(host)
            await db.flush()
            print(f"Created host user: host@example.com / host123")

        for data in SEED_PROPERTIES:
            images = data.pop("images", [])
            prop = Property(host_id=host.id, **data)
            db.add(prop)
            await db.flush()
            for url in images:
                db.add(PropertyImage(property_id=prop.id, image_url=url))

        await db.commit()
        print(f"Seeded {len(SEED_PROPERTIES)} properties.")


if __name__ == "__main__":
    asyncio.run(seed())

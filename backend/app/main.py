from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.database import engine, Base
from app.routers import auth_router, users_router, properties_router, bookings_router, reviews_router, admin_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        from app.models import User, Property, PropertyImage, Amenity, PropertyAmenity, Booking, Review
        await conn.run_sync(Base.metadata.create_all)
    yield
    await engine.dispose()


app = FastAPI(title="Rental Booking API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(properties_router)
app.include_router(bookings_router)
app.include_router(reviews_router)
app.include_router(admin_router)


@app.get("/health")
async def health():
    return {"status": "ok"}

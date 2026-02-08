"""Shop API endpoints."""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.error_codes import ERROR_INTERNAL, ERROR_INVALID_UUID
from app.core.exceptions import AppException
from app.domain.repositories.game_transaction_repository import GameTransactionRepository
from app.domain.repositories.profile_repository import ProfileRepository
from app.domain.repositories.shop_item_repository import ShopItemRepository
from app.domain.repositories.user_inventory_repository import UserInventoryRepository
from app.domain.services.shop_service import ShopService
from app.infrastructure.database import get_db_session
from app.api.routes import SHOP_PREFIX

router = APIRouter(prefix=SHOP_PREFIX, tags=["shop"])


class ShopItemResponse(BaseModel):
    id: str
    name: str
    item_type: str
    price: int
    image_path: str
    rarity: str
    owned: bool
    is_equipped: bool


class GetShopItemsResponse(BaseModel):
    items: list[ShopItemResponse]
    total: int


class PurchaseItemRequest(BaseModel):
    item_id: str = Field(..., description="Shop item UUID")


class PurchaseItemResponse(BaseModel):
    success: bool
    item: dict[str, Any]
    gold_remaining: int
    message: str


class SeedItemsRequest(BaseModel):
    items: list[dict[str, Any]] = Field(..., description="List of items to seed")


class SeedItemsResponse(BaseModel):
    success: bool
    created: int
    skipped: int
    total: int


def _build_shop_service(db: AsyncSession) -> ShopService:
    """Build a ShopService with all required repositories."""
    return ShopService(
        shop_item_repo=ShopItemRepository(db),
        user_inventory_repo=UserInventoryRepository(db),
        profile_repo=ProfileRepository(db),
        game_transaction_repo=GameTransactionRepository(db),
    )


@router.get("/items", response_model=GetShopItemsResponse)
async def get_shop_items(
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
    item_type: str | None = Query(default=None),
    rarity: str | None = Query(default=None),
) -> dict[str, Any]:
    """Get shop items list with user ownership status."""
    try:
        return await _build_shop_service(db).get_shop_items(user_id=user_id, item_type=item_type, rarity=rarity)
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": ERROR_INTERNAL, "message": str(e)})


@router.post("/purchase", response_model=PurchaseItemResponse)
async def purchase_item(
    request: PurchaseItemRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, Any]:
    """Purchase a shop item."""
    try:
        item_id = UUID(request.item_id)
        return await _build_shop_service(db).purchase_item(user_id=user_id, item_id=item_id)
    except ValueError:
        raise HTTPException(status_code=400, detail={"code": ERROR_INVALID_UUID, "message": "Invalid item UUID"})
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": ERROR_INTERNAL, "message": str(e)})


@router.post("/seed-items", response_model=SeedItemsResponse)
async def seed_items(
    request: SeedItemsRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, Any]:
    """Seed initial shop items (admin endpoint)."""
    try:
        return await _build_shop_service(db).seed_initial_items(items_data=request.items)
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": ERROR_INTERNAL, "message": str(e)})

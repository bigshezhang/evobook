"""Shop API endpoints.

This module provides endpoints for browsing shop items and purchasing.
"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.error_codes import ERROR_INTERNAL, ERROR_INVALID_UUID
from app.core.exceptions import AppException
from app.domain.services.shop_service import ShopService
from app.infrastructure.database import get_db_session

router = APIRouter(prefix="/shop", tags=["shop"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class ShopItemResponse(BaseModel):
    """Shop item data."""

    id: str
    name: str
    item_type: str
    price: int
    image_path: str
    rarity: str
    owned: bool
    is_equipped: bool


class GetShopItemsResponse(BaseModel):
    """Get shop items response."""

    items: list[ShopItemResponse]
    total: int


class PurchaseItemRequest(BaseModel):
    """Purchase item request."""

    item_id: str = Field(..., description="Shop item UUID")


class PurchaseItemResponse(BaseModel):
    """Purchase item response."""

    success: bool
    item: dict[str, Any] = Field(..., description="Purchased item details")
    gold_remaining: int
    message: str


class SeedItemsRequest(BaseModel):
    """Seed shop items request."""

    items: list[dict[str, Any]] = Field(..., description="List of items to seed")


class SeedItemsResponse(BaseModel):
    """Seed items response."""

    success: bool
    created: int
    skipped: int
    total: int


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/items", response_model=GetShopItemsResponse)
async def get_shop_items(
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
    item_type: str | None = Query(default=None, description="Filter by item type ('clothes', 'furniture')"),
    rarity: str | None = Query(default=None, description="Filter by rarity"),
) -> dict[str, Any]:
    """Get shop items list with user ownership status.

    Args:
        user_id: Authenticated user ID from JWT.
        db: Database session.
        item_type: Optional filter by item type.
        rarity: Optional filter by rarity.

    Returns:
        List of shop items with ownership and equipped status.
    """
    try:
        return await ShopService.get_shop_items(
            user_id=user_id,
            db=db,
            item_type=item_type,
            rarity=rarity,
        )
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": ERROR_INTERNAL, "message": str(e)},
        )


@router.post("/purchase", response_model=PurchaseItemResponse)
async def purchase_item(
    request: PurchaseItemRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, Any]:
    """Purchase a shop item.

    Args:
        request: Purchase request with item_id.
        user_id: Authenticated user ID from JWT.
        db: Database session.

    Returns:
        Purchase result with item details and remaining gold.

    Raises:
        AppException:
            - ITEM_NOT_FOUND: Item doesn't exist
            - ALREADY_OWNED: User already owns this item
            - INSUFFICIENT_GOLD: Not enough gold
    """
    try:
        item_id = UUID(request.item_id)
        return await ShopService.purchase_item(
            user_id=user_id,
            item_id=item_id,
            db=db,
        )
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail={"code": ERROR_INVALID_UUID, "message": "Invalid item UUID"},
        )
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": ERROR_INTERNAL, "message": str(e)},
        )


@router.post("/seed-items", response_model=SeedItemsResponse)
async def seed_items(
    request: SeedItemsRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, Any]:
    """Seed initial shop items (admin endpoint).

    Args:
        request: Items to seed.
        user_id: Authenticated user ID from JWT.
        db: Database session.

    Returns:
        Seed operation result.
    """
    try:
        return await ShopService.seed_initial_items(
            db=db,
            items_data=request.items,
        )
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": ERROR_INTERNAL, "message": str(e)},
        )

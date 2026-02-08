"""Inventory API endpoints.

This module provides endpoints for managing user inventory (owned items).
"""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.error_codes import ERROR_INTERNAL, ERROR_INVALID_UUID
from app.core.exceptions import AppException
from app.domain.services.inventory_service import InventoryService
from app.infrastructure.database import get_db_session

router = APIRouter(prefix="/inventory", tags=["inventory"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class InventoryItemResponse(BaseModel):
    """Inventory item data."""

    item_id: str
    name: str
    item_type: str
    image_path: str
    is_equipped: bool
    purchased_at: str


class GetInventoryResponse(BaseModel):
    """Get inventory response."""

    inventory: list[InventoryItemResponse]
    total: int


class EquipItemRequest(BaseModel):
    """Equip item request."""

    item_id: str = Field(..., description="Item UUID to equip")
    equip: bool = Field(..., description="True to equip, False to unequip")


class EquipItemResponse(BaseModel):
    """Equip item response."""

    success: bool
    item: dict[str, Any] = Field(..., description="Item details")
    message: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("", response_model=GetInventoryResponse)
async def get_inventory(
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
    item_type: str | None = Query(default=None, description="Filter by item type"),
    equipped_only: bool = Query(default=False, description="Only return equipped items"),
) -> dict[str, Any]:
    """Get user's inventory.

    Args:
        user_id: Authenticated user ID from JWT.
        db: Database session.
        item_type: Optional filter by item type.
        equipped_only: If True, only return equipped items.

    Returns:
        User's inventory items.
    """
    try:
        return await InventoryService.get_user_inventory(
            user_id=user_id,
            db=db,
            item_type=item_type,
            equipped_only=equipped_only,
        )
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": ERROR_INTERNAL, "message": str(e)},
        )


@router.put("/equip", response_model=EquipItemResponse)
async def equip_item(
    request: EquipItemRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, Any]:
    """Equip or unequip an item.

    For clothes: automatically unequips other clothes when equipping.
    For furniture: can equip multiple.

    Args:
        request: Equip request with item_id and equip flag.
        user_id: Authenticated user ID from JWT.
        db: Database session.

    Returns:
        Equip operation result.

    Raises:
        AppException:
            - ITEM_NOT_OWNED: User doesn't own this item
    """
    try:
        item_id = UUID(request.item_id)

        if request.equip:
            return await InventoryService.equip_item(
                user_id=user_id,
                item_id=item_id,
                db=db,
            )
        else:
            return await InventoryService.unequip_item(
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

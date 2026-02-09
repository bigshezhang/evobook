"""Inventory API endpoints."""

from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.error_codes import ERROR_INTERNAL, ERROR_INVALID_UUID
from app.core.exceptions import AppException
from app.domain.repositories.profile_repository import ProfileRepository
from app.domain.repositories.shop_item_repository import ShopItemRepository
from app.domain.repositories.user_inventory_repository import UserInventoryRepository
from app.domain.services.inventory_service import InventoryService
from app.infrastructure.database import get_db_session
from app.api.routes import INVENTORY_PREFIX

router = APIRouter(prefix=INVENTORY_PREFIX, tags=["inventory"])


class InventoryItemResponse(BaseModel):
    item_id: str
    name: str
    item_type: str
    image_path: str
    is_equipped: bool
    purchased_at: str


class GetInventoryResponse(BaseModel):
    inventory: list[InventoryItemResponse]
    total: int


class EquipItemRequest(BaseModel):
    item_id: str = Field(..., description="Item UUID to equip")
    equip: bool = Field(..., description="True to equip, False to unequip")


class EquipItemResponse(BaseModel):
    success: bool
    item: dict[str, Any]
    message: str


def _build_inventory_service(db: AsyncSession) -> InventoryService:
    """Build an InventoryService with all required repositories."""
    return InventoryService(
        user_inventory_repo=UserInventoryRepository(db),
        shop_item_repo=ShopItemRepository(db),
        profile_repo=ProfileRepository(db),
    )


@router.get("", response_model=GetInventoryResponse)
async def get_inventory(
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
    item_type: str | None = Query(default=None),
    equipped_only: bool = Query(default=False),
) -> dict[str, Any]:
    """Get user's inventory."""
    try:
        return await _build_inventory_service(db).get_user_inventory(
            user_id=user_id, item_type=item_type, equipped_only=equipped_only,
        )
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": ERROR_INTERNAL, "message": str(e)})


@router.put("/equip", response_model=EquipItemResponse)
async def equip_item(
    request: EquipItemRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict[str, Any]:
    """Equip or unequip an item."""
    try:
        item_id = UUID(request.item_id)
        service = _build_inventory_service(db)
        if request.equip:
            return await service.equip_item(user_id=user_id, item_id=item_id)
        else:
            return await service.unequip_item(user_id=user_id, item_id=item_id)
    except ValueError:
        raise HTTPException(status_code=400, detail={"code": ERROR_INVALID_UUID, "message": "Invalid item UUID"})
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail={"code": ERROR_INTERNAL, "message": str(e)})

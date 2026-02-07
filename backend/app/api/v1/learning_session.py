"""Learning session API endpoints.

This module provides endpoints for tracking learning time via heartbeats.
"""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.exceptions import AppException
from app.domain.services.learning_session_service import LearningSessionService
from app.infrastructure.database import get_db_session

router = APIRouter(prefix="/learning", tags=["learning"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class HeartbeatRequest(BaseModel):
    """学习心跳请求。"""

    course_map_id: str = Field(..., description="课程 UUID")
    node_id: int = Field(..., description="节点 ID")
    client_timestamp: str | None = Field(
        default=None,
        description="客户端时间戳（ISO 8601 格式），可选",
    )


class HeartbeatResponse(BaseModel):
    """学习心跳响应。"""

    acknowledged: bool = Field(..., description="心跳是否被接受并计入学习时长")
    total_study_seconds: int = Field(..., description="用户总学习时长（秒）")
    reason: str | None = Field(
        default=None,
        description="如果 acknowledged=False，说明原因",
    )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/heartbeat", response_model=HeartbeatResponse)
async def record_heartbeat(
    request: HeartbeatRequest,
    user_id: Annotated[UUID, Depends(get_current_user_id)],
    db: Annotated[AsyncSession, Depends(get_db_session)],
) -> dict:
    """接收学习心跳包。
    
    客户端每 30 秒发送一次心跳，后端记录学习时长。
    
    防刷机制：
    - 单个节点累计时长超过 `estimated_minutes * 2` 后，心跳不再计入
    
    Args:
        request: 心跳请求
        user_id: 认证用户 ID（从 JWT 提取）
        db: 数据库会话
    
    Returns:
        HeartbeatResponse:
            - acknowledged: True 表示心跳被接受并计入学习时长
            - total_study_seconds: 用户总学习时长（秒）
            - reason: 如果 acknowledged=False，说明原因（如 TIME_LIMIT_REACHED）
    
    Raises:
        400: 无效的请求参数
        401: 未认证
        404: 课程或节点不存在
        500: 内部错误
    """
    try:
        course_map_id = UUID(request.course_map_id)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail={
                "code": "INVALID_UUID",
                "message": "Invalid course_map_id format",
            },
        )
    
    try:
        result = await LearningSessionService.process_heartbeat(
            user_id=user_id,
            course_map_id=course_map_id,
            node_id=request.node_id,
            db=db,
        )
        
        return result
    
    except AppException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": str(e)},
        )

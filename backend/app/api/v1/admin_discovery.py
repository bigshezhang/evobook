"""Admin Discovery API — internal dashboard endpoints.

Provides CRUD for managing discovery_courses (the public course catalog)
and read access to course_maps (source pool for publishing).

Auth: X-Admin-Key header matched against ADMIN_API_KEY env var.
"""

from decimal import Decimal
from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes import ADMIN_PREFIX
from app.config import get_settings
from app.core.error_codes import ERROR_NOT_FOUND
from app.core.logging import get_logger
from app.domain.models.course_map import CourseMap
from app.domain.models.discovery_course import DiscoveryCourse
from app.domain.models.profile import Profile
from app.infrastructure.database import get_db_session

logger = get_logger(__name__)

router = APIRouter(prefix=ADMIN_PREFIX, tags=["admin-discovery"])


# ---------------------------------------------------------------------------
# Auth dependency
# ---------------------------------------------------------------------------

def verify_admin_key(x_admin_key: str | None = Header(default=None)) -> None:
    """Verify the X-Admin-Key header matches ADMIN_API_KEY setting."""
    settings = get_settings()
    if not settings.admin_api_key:
        return  # no key configured — open access (dev mode)
    if x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=401, detail="Invalid or missing X-Admin-Key")


AdminAuth = Annotated[None, Depends(verify_admin_key)]


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class CourseMapListItem(BaseModel):
    """Summary of a user course_map for display in the admin source pool."""

    id: str
    user_id: str | None
    user_email: str | None
    topic: str
    level: str
    mode: str
    language: str
    node_count: int
    created_at: str


class CourseMapListResponse(BaseModel):
    items: list[CourseMapListItem]
    total: int
    page: int
    page_size: int


class DiscoveryCourseAdminItem(BaseModel):
    """Full discovery course record for admin display."""

    id: str
    preset_id: str
    title: str
    description: str | None
    image_url: str | None
    category: str
    display_order: int
    rating: float
    tags: list[str] | None
    is_active: bool
    view_count: int
    start_count: int
    completion_count: int
    source_course_map_id: str | None
    has_nodes: bool
    created_at: str
    updated_at: str


class PublishDiscoveryCourseRequest(BaseModel):
    """Request body for publishing a new discovery course from a source course_map."""

    source_course_map_id: str = Field(..., description="UUID of the source course_map to copy content from")
    preset_id: str = Field(..., description="Unique slug identifier, e.g. 'quantum-physics-intro'")
    title: str
    description: str | None = None
    image_url: str | None = None
    category: str = Field(..., description="'recommended' | 'popular' | 'hot'")
    rating: float = Field(default=4.5, ge=0, le=5)
    display_order: int = Field(default=0, ge=0)
    tags: list[str] | None = None


class UpdateDiscoveryCourseRequest(BaseModel):
    """Partial update for a discovery course."""

    title: str | None = None
    description: str | None = None
    image_url: str | None = None
    category: str | None = None
    display_order: int | None = None
    rating: float | None = None
    tags: list[str] | None = None
    is_active: bool | None = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/discovery/course-maps", response_model=CourseMapListResponse)
async def list_course_maps_for_discovery(
    _: AdminAuth,
    db: Annotated[AsyncSession, Depends(get_db_session)] = None,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    topic: str | None = Query(default=None, description="Filter by topic (partial match)"),
) -> dict[str, Any]:
    """List all user course_maps with pagination, for admin to browse and pick from."""
    offset = (page - 1) * page_size

    stmt = (
        select(CourseMap, Profile.email)
        .outerjoin(Profile, CourseMap.user_id == Profile.id)
        .order_by(desc(CourseMap.created_at))
    )
    if topic:
        stmt = stmt.where(CourseMap.topic.ilike(f"%{topic}%"))

    count_stmt = select(func.count()).select_from(CourseMap)
    if topic:
        count_stmt = count_stmt.where(CourseMap.topic.ilike(f"%{topic}%"))

    total_result = await db.execute(count_stmt)
    total = total_result.scalar_one()

    paginated_stmt = stmt.offset(offset).limit(page_size)
    result = await db.execute(paginated_stmt)
    rows = result.all()

    items = [
        CourseMapListItem(
            id=str(cm.id),
            user_id=str(cm.user_id) if cm.user_id else None,
            user_email=email,
            topic=cm.topic,
            level=cm.level,
            mode=cm.mode,
            language=cm.language,
            node_count=len(cm.nodes) if cm.nodes else 0,
            created_at=cm.created_at.isoformat(),
        )
        for cm, email in rows
    ]

    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/discovery-courses", response_model=list[DiscoveryCourseAdminItem])
async def list_discovery_courses_admin(
    _: AdminAuth,
    db: Annotated[AsyncSession, Depends(get_db_session)] = None,
) -> list[dict[str, Any]]:
    """List all discovery courses (including inactive) for admin management."""
    stmt = select(DiscoveryCourse).order_by(
        DiscoveryCourse.category, DiscoveryCourse.display_order
    )
    result = await db.execute(stmt)
    courses = result.scalars().all()

    return [
        {
            "id": str(c.id),
            "preset_id": c.preset_id,
            "title": c.title,
            "description": c.description,
            "image_url": c.image_url,
            "category": c.category,
            "display_order": c.display_order,
            "rating": float(c.rating),
            "tags": c.tags,
            "is_active": c.is_active,
            "view_count": c.view_count,
            "start_count": c.start_count,
            "completion_count": c.completion_count,
            "source_course_map_id": str(c.source_course_map_id) if c.source_course_map_id else None,
            "has_nodes": c.nodes is not None and len(c.nodes) > 0,
            "created_at": c.created_at.isoformat(),
            "updated_at": c.updated_at.isoformat(),
        }
        for c in courses
    ]


@router.post("/discovery-courses", response_model=DiscoveryCourseAdminItem, status_code=201)
async def publish_discovery_course(
    body: PublishDiscoveryCourseRequest,
    _: AdminAuth,
    db: Annotated[AsyncSession, Depends(get_db_session)] = None,
) -> dict[str, Any]:
    """Publish a new discovery course by copying content from a source course_map."""
    # Validate category
    valid_categories = {"recommended", "popular", "hot"}
    if body.category not in valid_categories:
        raise HTTPException(
            status_code=422,
            detail=f"category must be one of {sorted(valid_categories)}",
        )

    # Check preset_id uniqueness
    existing_stmt = select(DiscoveryCourse).where(DiscoveryCourse.preset_id == body.preset_id)
    existing = (await db.execute(existing_stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail=f"preset_id '{body.preset_id}' already exists")

    # Load source course_map
    source_id = UUID(body.source_course_map_id)
    cm_stmt = select(CourseMap).where(CourseMap.id == source_id)
    source_cm = (await db.execute(cm_stmt)).scalar_one_or_none()
    if source_cm is None:
        raise HTTPException(
            status_code=404,
            detail={"code": ERROR_NOT_FOUND, "message": f"course_map '{body.source_course_map_id}' not found"},
        )

    discovery = DiscoveryCourse(
        preset_id=body.preset_id,
        title=body.title,
        description=body.description,
        image_url=body.image_url,
        category=body.category,
        rating=Decimal(str(body.rating)),
        display_order=body.display_order,
        tags=body.tags,
        seed_context={
            "topic": source_cm.topic,
            "suggested_level": source_cm.level,
            "key_concepts": source_cm.map_meta.get("key_concepts", ""),
            "focus": source_cm.focus,
        },
        nodes=source_cm.nodes,
        map_meta=source_cm.map_meta,
        source_course_map_id=source_id,
        is_active=True,
    )
    db.add(discovery)
    await db.commit()
    await db.refresh(discovery)

    logger.info(
        "Published discovery course",
        preset_id=discovery.preset_id,
        source_course_map_id=str(source_id),
        category=discovery.category,
    )

    return {
        "id": str(discovery.id),
        "preset_id": discovery.preset_id,
        "title": discovery.title,
        "description": discovery.description,
        "image_url": discovery.image_url,
        "category": discovery.category,
        "display_order": discovery.display_order,
        "rating": float(discovery.rating),
        "tags": discovery.tags,
        "is_active": discovery.is_active,
        "view_count": discovery.view_count,
        "start_count": discovery.start_count,
        "completion_count": discovery.completion_count,
        "source_course_map_id": str(discovery.source_course_map_id),
        "has_nodes": discovery.nodes is not None and len(discovery.nodes) > 0,
        "created_at": discovery.created_at.isoformat(),
        "updated_at": discovery.updated_at.isoformat(),
    }


@router.patch("/discovery-courses/{discovery_id}", response_model=DiscoveryCourseAdminItem)
async def update_discovery_course(
    discovery_id: str,
    body: UpdateDiscoveryCourseRequest,
    _: AdminAuth,
    db: Annotated[AsyncSession, Depends(get_db_session)] = None,
) -> dict[str, Any]:
    """Update metadata of an existing discovery course."""
    stmt = select(DiscoveryCourse).where(DiscoveryCourse.id == UUID(discovery_id))
    course = (await db.execute(stmt)).scalar_one_or_none()
    if course is None:
        raise HTTPException(
            status_code=404,
            detail={"code": ERROR_NOT_FOUND, "message": f"discovery_course '{discovery_id}' not found"},
        )

    if body.category is not None:
        valid_categories = {"recommended", "popular", "hot"}
        if body.category not in valid_categories:
            raise HTTPException(
                status_code=422,
                detail=f"category must be one of {sorted(valid_categories)}",
            )
        course.category = body.category

    if body.title is not None:
        course.title = body.title
    if body.description is not None:
        course.description = body.description
    if body.image_url is not None:
        course.image_url = body.image_url
    if body.display_order is not None:
        course.display_order = body.display_order
    if body.rating is not None:
        course.rating = Decimal(str(body.rating))
    if body.tags is not None:
        course.tags = body.tags
    if body.is_active is not None:
        course.is_active = body.is_active

    await db.commit()
    await db.refresh(course)

    logger.info("Updated discovery course", preset_id=course.preset_id, discovery_id=discovery_id)

    return {
        "id": str(course.id),
        "preset_id": course.preset_id,
        "title": course.title,
        "description": course.description,
        "image_url": course.image_url,
        "category": course.category,
        "display_order": course.display_order,
        "rating": float(course.rating),
        "tags": course.tags,
        "is_active": course.is_active,
        "view_count": course.view_count,
        "start_count": course.start_count,
        "completion_count": course.completion_count,
        "source_course_map_id": str(course.source_course_map_id) if course.source_course_map_id else None,
        "has_nodes": course.nodes is not None and len(course.nodes) > 0,
        "created_at": course.created_at.isoformat(),
        "updated_at": course.updated_at.isoformat(),
    }


@router.delete("/discovery-courses/{discovery_id}", status_code=204)
async def delete_discovery_course(
    discovery_id: str,
    _: AdminAuth,
    db: Annotated[AsyncSession, Depends(get_db_session)] = None,
) -> None:
    """Delete a discovery course from the public catalog."""
    stmt = select(DiscoveryCourse).where(DiscoveryCourse.id == UUID(discovery_id))
    course = (await db.execute(stmt)).scalar_one_or_none()
    if course is None:
        raise HTTPException(
            status_code=404,
            detail={"code": ERROR_NOT_FOUND, "message": f"discovery_course '{discovery_id}' not found"},
        )

    await db.delete(course)
    await db.commit()

    logger.info("Deleted discovery course", preset_id=course.preset_id, discovery_id=discovery_id)

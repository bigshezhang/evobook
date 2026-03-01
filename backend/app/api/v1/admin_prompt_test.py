"""Admin prompt test API endpoints.

Internal API for the Dashboard LLM testing system.
All endpoints are prefixed with /api/admin and require no auth
(same as the rest of the dashboard – client-side password gate).
"""

from typing import Any
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes import ADMIN_PREFIX
from app.config import get_settings
from app.core.logging import get_logger
from app.domain.models.course_map import CourseMap
from app.domain.models.prompt_test import PromptTestResult, PromptTestRun
from app.domain.services.prompt_test_service import create_and_run_test
from app.infrastructure.database import get_db_session
from app.llm.client import LLMClient
from app.prompts.registry import PromptName, PromptRegistry

from fastapi import Depends

logger = get_logger(__name__)

router = APIRouter(prefix=ADMIN_PREFIX, tags=["admin"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------


class PromptInfo(BaseModel):
    """Summary info for one prompt."""

    name: str
    hash: str
    preview: str = Field(..., description="First 200 chars of the prompt text")


class PromptDetail(BaseModel):
    """Full prompt text."""

    name: str
    hash: str
    text: str


class CourseMapSummary(BaseModel):
    """Minimal course map info for the selector."""

    id: str
    topic: str
    level: str
    mode: str
    language: str
    created_at: str


class CreateTestRunRequest(BaseModel):
    """Request body to create a batch test run."""

    prompt_name: str = Field(..., description="Prompt name key (see /api/admin/prompts)")
    prompt_text: str = Field(..., description="Prompt template text (may be a modified version)")
    course_map_ids: list[str] = Field(..., min_length=1, description="UUIDs of course maps to test against")


class TestRunSummary(BaseModel):
    """Summary row for the test records table."""

    id: str
    prompt_name: str
    prompt_hash: str
    course_count: int
    status: str
    score: int | None
    review_comment: str | None
    created_at: str


class TestResultItem(BaseModel):
    """One result entry within a test run detail."""

    id: str
    course_map_id: str
    input_variables: dict[str, Any]
    output_raw: str | None
    output_parsed: dict[str, Any] | None
    status: str
    error_message: str | None
    latency_ms: int | None
    created_at: str


class TestRunDetail(BaseModel):
    """Full detail of a test run including all results."""

    id: str
    prompt_name: str
    prompt_hash: str
    prompt_text: str
    course_map_ids: list[str]
    status: str
    score: int | None
    review_comment: str | None
    created_at: str
    results: list[TestResultItem]


class UpdateTestRunRequest(BaseModel):
    """Payload for saving score and review_comment on a completed run."""

    score: int | None = Field(None, ge=1, le=5)
    review_comment: str | None = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/prompts", response_model=list[PromptInfo])
async def list_prompts() -> list[PromptInfo]:
    """List all available prompts with hash and preview.

    Returns:
        List of PromptInfo objects for every whitelisted prompt.
    """
    result: list[PromptInfo] = []
    for name in PromptRegistry.get_all_prompt_names():
        try:
            text, h = PromptRegistry.get_prompt_with_hash(name)
            result.append(
                PromptInfo(
                    name=name.value,
                    hash=h,
                    preview=text[:200],
                )
            )
        except Exception as e:
            logger.warning("Failed to load prompt", name=name.value, error=str(e))
    return result


@router.get("/prompts/{name}", response_model=PromptDetail)
async def get_prompt(name: str) -> PromptDetail:
    """Get full prompt text by name.

    Args:
        name: Prompt name key (e.g. "clarification").

    Returns:
        PromptDetail with full text and hash.
    """
    try:
        text, h = PromptRegistry.get_prompt_with_hash(name)
    except Exception:
        raise HTTPException(status_code=404, detail=f"Prompt '{name}' not found")
    return PromptDetail(name=name, hash=h, text=text)


@router.get("/course-maps", response_model=list[CourseMapSummary])
async def list_course_maps(
    db: AsyncSession = Depends(get_db_session),
) -> list[CourseMapSummary]:
    """List all course maps for the selector UI.

    Returns:
        List of minimal CourseMapSummary objects ordered by most recent first.
    """
    stmt = select(CourseMap).order_by(desc(CourseMap.created_at)).limit(200)
    rows = await db.execute(stmt)
    maps = rows.scalars().all()
    return [
        CourseMapSummary(
            id=str(cm.id),
            topic=cm.topic,
            level=cm.level,
            mode=cm.mode,
            language=cm.language,
            created_at=cm.created_at.isoformat(),
        )
        for cm in maps
    ]


@router.post("/prompt-test-runs", response_model=TestRunSummary, status_code=201)
async def create_test_run(
    body: CreateTestRunRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db_session),
) -> TestRunSummary:
    """Create a batch test run and trigger async execution.

    Creates one PromptTestResult row per course_map_id with status=pending,
    then fires background execution.

    Args:
        body: Request with prompt_name, prompt_text, and course_map_ids.
        background_tasks: FastAPI background tasks for async execution.
        db: Database session.

    Returns:
        TestRunSummary for the newly created run.
    """
    # Validate prompt name
    valid_names = [pn.value for pn in PromptName]
    if body.prompt_name not in valid_names:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid prompt_name. Must be one of: {valid_names}",
        )

    import hashlib
    prompt_hash = hashlib.sha256(body.prompt_text.encode("utf-8")).hexdigest()
    run_id = uuid4()

    # Create the run record
    run = PromptTestRun(
        id=run_id,
        prompt_name=body.prompt_name,
        prompt_text=body.prompt_text,
        prompt_hash=prompt_hash,
        course_map_ids=[str(cid) for cid in body.course_map_ids],
        status="running",
    )
    db.add(run)

    # Create one pending result per course map
    for cid_str in body.course_map_ids:
        result = PromptTestResult(
            id=uuid4(),
            run_id=run_id,
            course_map_id=UUID(cid_str),
            input_variables={},
            status="pending",
        )
        db.add(result)

    await db.commit()

    logger.info(
        "Prompt test run created",
        run_id=str(run_id),
        prompt_name=body.prompt_name,
        course_count=len(body.course_map_ids),
    )

    # Fire background execution
    settings = get_settings()
    llm_client = LLMClient(settings)
    background_tasks.add_task(create_and_run_test, run_id=run_id, llm_client=llm_client)

    return TestRunSummary(
        id=str(run.id),
        prompt_name=run.prompt_name,
        prompt_hash=run.prompt_hash,
        course_count=len(run.course_map_ids),
        status=run.status,
        score=run.score,
        review_comment=run.review_comment,
        created_at=run.created_at.isoformat(),
    )


@router.get("/prompt-test-runs", response_model=list[TestRunSummary])
async def list_test_runs(
    prompt_name: str | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db_session),
) -> list[TestRunSummary]:
    """List all test runs, optionally filtered by prompt_name.

    Args:
        prompt_name: Optional filter by prompt name.
        limit: Maximum rows to return (default 50).
        db: Database session.

    Returns:
        List of TestRunSummary ordered by most recent first.
    """
    stmt = select(PromptTestRun).order_by(desc(PromptTestRun.created_at)).limit(limit)
    if prompt_name:
        stmt = stmt.where(PromptTestRun.prompt_name == prompt_name)

    rows = await db.execute(stmt)
    runs = rows.scalars().all()
    return [
        TestRunSummary(
            id=str(r.id),
            prompt_name=r.prompt_name,
            prompt_hash=r.prompt_hash,
            course_count=len(r.course_map_ids) if r.course_map_ids else 0,
            status=r.status,
            score=r.score,
            review_comment=r.review_comment,
            created_at=r.created_at.isoformat(),
        )
        for r in runs
    ]


@router.get("/prompt-test-runs/{run_id}", response_model=TestRunDetail)
async def get_test_run(
    run_id: UUID,
    db: AsyncSession = Depends(get_db_session),
) -> TestRunDetail:
    """Get full detail of a test run including all results.

    Args:
        run_id: UUID of the test run.
        db: Database session.

    Returns:
        TestRunDetail with all child results.
    """
    run = await db.get(PromptTestRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Test run not found")

    stmt = select(PromptTestResult).where(PromptTestResult.run_id == run_id)
    rows = await db.execute(stmt)
    results = rows.scalars().all()

    return TestRunDetail(
        id=str(run.id),
        prompt_name=run.prompt_name,
        prompt_hash=run.prompt_hash,
        prompt_text=run.prompt_text,
        course_map_ids=[str(cid) for cid in (run.course_map_ids or [])],
        status=run.status,
        score=run.score,
        review_comment=run.review_comment,
        created_at=run.created_at.isoformat(),
        results=[
            TestResultItem(
                id=str(r.id),
                course_map_id=str(r.course_map_id),
                input_variables=r.input_variables or {},
                output_raw=r.output_raw,
                output_parsed=r.output_parsed,
                status=r.status,
                error_message=r.error_message,
                latency_ms=r.latency_ms,
                created_at=r.created_at.isoformat(),
            )
            for r in results
        ],
    )


@router.patch("/prompt-test-runs/{run_id}", response_model=TestRunSummary)
async def update_test_run(
    run_id: UUID,
    body: UpdateTestRunRequest,
    db: AsyncSession = Depends(get_db_session),
) -> TestRunSummary:
    """Save score and review_comment for a completed test run.

    Args:
        run_id: UUID of the test run.
        body: Score (1-5) and optional review_comment.
        db: Database session.

    Returns:
        Updated TestRunSummary.
    """
    run = await db.get(PromptTestRun, run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Test run not found")

    if body.score is not None:
        run.score = body.score
    if body.review_comment is not None:
        run.review_comment = body.review_comment

    await db.commit()

    return TestRunSummary(
        id=str(run.id),
        prompt_name=run.prompt_name,
        prompt_hash=run.prompt_hash,
        course_count=len(run.course_map_ids) if run.course_map_ids else 0,
        status=run.status,
        score=run.score,
        review_comment=run.review_comment,
        created_at=run.created_at.isoformat(),
    )

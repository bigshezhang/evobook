"""Base repository providing common CRUD operations.

All entity repositories inherit from this base class to share
common database access patterns.
"""

from typing import Generic, Type, TypeVar
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

T = TypeVar("T")


class BaseRepository(Generic[T]):
    """Base repository with common CRUD operations.

    Attributes:
        db: Async database session.
        model_class: SQLAlchemy model class for this repository.
    """

    def __init__(self, db: AsyncSession, model_class: Type[T]) -> None:
        """Initialize base repository.

        Args:
            db: Async database session.
            model_class: SQLAlchemy model class managed by this repository.
        """
        self.db = db
        self.model_class = model_class

    async def get_by_id(self, id: UUID) -> T | None:
        """Find an entity by its primary key.

        Args:
            id: Entity UUID primary key.

        Returns:
            Entity instance or None if not found.
        """
        stmt = select(self.model_class).where(self.model_class.id == id)  # type: ignore[attr-defined]
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def add(self, entity: T) -> T:
        """Add a new entity to the session.

        Args:
            entity: Entity instance to persist.

        Returns:
            The added entity (same reference).
        """
        self.db.add(entity)
        await self.db.flush()
        return entity

    async def add_no_flush(self, entity: T) -> T:
        """Add a new entity to the session without flushing.

        Args:
            entity: Entity instance to persist.

        Returns:
            The added entity (same reference).
        """
        self.db.add(entity)
        return entity

    async def commit(self) -> None:
        """Commit the current transaction."""
        await self.db.commit()

    async def flush(self) -> None:
        """Flush pending changes without committing."""
        await self.db.flush()

    async def refresh(self, entity: T) -> None:
        """Refresh an entity from the database.

        Args:
            entity: Entity instance to refresh.
        """
        await self.db.refresh(entity)

    async def rollback(self) -> None:
        """Rollback the current transaction."""
        await self.db.rollback()

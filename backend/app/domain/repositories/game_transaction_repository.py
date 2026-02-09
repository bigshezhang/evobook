"""Game transaction repository for currency transaction data access."""

from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.game_transaction import GameTransaction
from app.domain.repositories.base import BaseRepository


class GameTransactionRepository(BaseRepository[GameTransaction]):
    """Repository for GameTransaction entity data access."""

    def __init__(self, db: AsyncSession) -> None:
        """Initialize game transaction repository.

        Args:
            db: Async database session.
        """
        super().__init__(db, GameTransaction)

    async def create(self, transaction: GameTransaction) -> GameTransaction:
        """Add a new game transaction to the session.

        Args:
            transaction: GameTransaction entity to persist.

        Returns:
            The added transaction.
        """
        self.db.add(transaction)
        return transaction

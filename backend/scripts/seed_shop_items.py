"""Seed initial shop items into database.

This script populates the shop_items table with initial items based on
the frontend OutfitView.tsx item list.
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.domain.repositories.game_transaction_repository import GameTransactionRepository
from app.domain.repositories.profile_repository import ProfileRepository
from app.domain.repositories.shop_item_repository import ShopItemRepository
from app.domain.repositories.user_inventory_repository import UserInventoryRepository
from app.domain.services.shop_service import ShopService
from app.infrastructure.database import get_db_session


# Initial shop items data
# Based on frontend OutfitView.tsx
INITIAL_ITEMS = [
    # === CLOTHES (5 items) ===
    {
        "name": "default",
        "item_type": "clothes",
        "price": 0,
        "image_path": "/compressed_output/cloth_processed/default.webp",
        "rarity": "common",
        "is_default": True,
    },
    {
        "name": "dress",
        "item_type": "clothes",
        "price": 350,
        "image_path": "/compressed_output/cloth_processed/dress.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "glass",
        "item_type": "clothes",
        "price": 200,
        "image_path": "/compressed_output/cloth_processed/glass.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "suit",
        "item_type": "clothes",
        "price": 450,
        "image_path": "/compressed_output/cloth_processed/suit.webp",
        "rarity": "rare",
        "is_default": False,
    },
    {
        "name": "super",
        "item_type": "clothes",
        "price": 600,
        "image_path": "/compressed_output/cloth_processed/super.webp",
        "rarity": "epic",
        "is_default": False,
    },

    # === FURNITURE (35 items) ===
    {
        "name": "Black Office Chair",
        "item_type": "furniture",
        "price": 180,
        "image_path": "black_office_chair.png",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Cherry Blossom Branch",
        "item_type": "furniture",
        "price": 150,
        "image_path": "cherry_blossom_branch.png",
        "rarity": "rare",
        "is_default": False,
    },
    {
        "name": "Chinese Lantern",
        "item_type": "furniture",
        "price": 200,
        "image_path": "chinese_lantern_cherry_blossom.png",
        "rarity": "rare",
        "is_default": False,
    },
    {
        "name": "Chinese Tea Table",
        "item_type": "furniture",
        "price": 250,
        "image_path": "chinese_low_tea_table.png",
        "rarity": "rare",
        "is_default": False,
    },
    {
        "name": "Coat Rack",
        "item_type": "furniture",
        "price": 120,
        "image_path": "coat_rack.png",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Colorful Bunting",
        "item_type": "furniture",
        "price": 100,
        "image_path": "colorful_bunting.png",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Cute Cat",
        "item_type": "furniture",
        "price": 300,
        "image_path": "cute_cat.png",
        "rarity": "epic",
        "is_default": False,
    },
    {
        "name": "Floral Screen",
        "item_type": "furniture",
        "price": 280,
        "image_path": "floral_screen.png",
        "rarity": "rare",
        "is_default": False,
    },
    {
        "name": "Furry Footstool",
        "item_type": "furniture",
        "price": 150,
        "image_path": "furry_footstool.png",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Garden Border Grass",
        "item_type": "furniture",
        "price": 90,
        "image_path": "garden_border_grass.png",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Gift Boxes",
        "item_type": "furniture",
        "price": 130,
        "image_path": "gift_boxes.png",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Golden Corner",
        "item_type": "furniture",
        "price": 400,
        "image_path": "golden_ornamental_corner.png",
        "rarity": "epic",
        "is_default": False,
    },
    {
        "name": "Hanging Ivy",
        "item_type": "furniture",
        "price": 110,
        "image_path": "hanging_ivy.png",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Holly Berries",
        "item_type": "furniture",
        "price": 120,
        "image_path": "holly_berries.png",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Modern Armchair",
        "item_type": "furniture",
        "price": 220,
        "image_path": "modern_armchair.png",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Mushroom Border",
        "item_type": "furniture",
        "price": 140,
        "image_path": "mushroom_garden_border.png",
        "rarity": "rare",
        "is_default": False,
    },
    {
        "name": "Origami Crane",
        "item_type": "furniture",
        "price": 180,
        "image_path": "origami_crane_string.png",
        "rarity": "rare",
        "is_default": False,
    },
    {
        "name": "Pink Bow Chair",
        "item_type": "furniture",
        "price": 200,
        "image_path": "pink_bow_chair.png",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Pink Ribbon Corner",
        "item_type": "furniture",
        "price": 90,
        "image_path": "pink_ribbon_corner.png",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Pink Vanity Desk",
        "item_type": "furniture",
        "price": 280,
        "image_path": "pink_vanity_desk.png",
        "rarity": "rare",
        "is_default": False,
    },
    {
        "name": "Potted Plant",
        "item_type": "furniture",
        "price": 100,
        "image_path": "potted_plant_blue_white.png",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Rose Corner",
        "item_type": "furniture",
        "price": 150,
        "image_path": "rose_corner_decoration.png",
        "rarity": "rare",
        "is_default": False,
    },
    {
        "name": "Seashells Starfish",
        "item_type": "furniture",
        "price": 130,
        "image_path": "seashells_starfish.png",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Side Table",
        "item_type": "furniture",
        "price": 160,
        "image_path": "solid_wood_side_table.png",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Square Cushion",
        "item_type": "furniture",
        "price": 80,
        "image_path": "square_cushion.png",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Vase with Flowers",
        "item_type": "furniture",
        "price": 120,
        "image_path": "vase_with_flowers.png",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Vintage Chandelier",
        "item_type": "furniture",
        "price": 350,
        "image_path": "vintage_chandelier.png",
        "rarity": "rare",
        "is_default": False,
    },
    {
        "name": "Vintage Gramophone",
        "item_type": "furniture",
        "price": 320,
        "image_path": "vintage_gramophone.png",
        "rarity": "rare",
        "is_default": False,
    },
    {
        "name": "Vintage Telephone",
        "item_type": "furniture",
        "price": 250,
        "image_path": "vintage_rotary_telephone.png",
        "rarity": "rare",
        "is_default": False,
    },
    {
        "name": "Wicker Armchair",
        "item_type": "furniture",
        "price": 190,
        "image_path": "wicker_armchair.png",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Wooden Bookshelf",
        "item_type": "furniture",
        "price": 240,
        "image_path": "wooden_bookshelf.png",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Wooden Chair",
        "item_type": "furniture",
        "price": 140,
        "image_path": "wooden_chair.png",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Wooden Floor Lamp",
        "item_type": "furniture",
        "price": 170,
        "image_path": "wooden_floor_lamp.png",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Wooden Nightstand",
        "item_type": "furniture",
        "price": 150,
        "image_path": "wooden_nightstand.png",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Wooden Round Table",
        "item_type": "furniture",
        "price": 200,
        "image_path": "wooden_round_table.png",
        "rarity": "common",
        "is_default": False,
    },
]


async def main() -> None:
    """Seed shop items."""
    print("🌱 Seeding shop items...")

    async for db in get_db_session():
        try:
            # Build service with all required repositories
            service = ShopService(
                shop_item_repo=ShopItemRepository(db),
                user_inventory_repo=UserInventoryRepository(db),
                profile_repo=ProfileRepository(db),
                game_transaction_repo=GameTransactionRepository(db),
            )
            result = await service.seed_initial_items(
                items_data=INITIAL_ITEMS,
            )

            print(f"✅ Seeding completed!")
            print(f"   - Created: {result['created']}")
            print(f"   - Skipped: {result['skipped']}")
            print(f"   - Total: {result['total']}")

            # Summary by type
            clothes_count = sum(1 for item in INITIAL_ITEMS if item["item_type"] == "clothes")
            furniture_count = sum(1 for item in INITIAL_ITEMS if item["item_type"] == "furniture")

            print(f"\n📊 Breakdown:")
            print(f"   - Clothes: {clothes_count}")
            print(f"   - Furniture: {furniture_count}")

        except Exception as e:
            print(f"❌ Error seeding items: {e}")
            raise


if __name__ == "__main__":
    asyncio.run(main())

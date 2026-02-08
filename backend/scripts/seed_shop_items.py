"""Seed initial shop items into database.

This script populates the shop_items table with initial items based on
the frontend OutfitView.tsx item list.
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.domain.services.shop_service import ShopService
from app.infrastructure.database import get_db_session


# Initial shop items data
# Based on frontend OutfitView.tsx
INITIAL_ITEMS = [
    # === CLOTHES (5 items) ===
    {
        "name": "No Outfit",
        "item_type": "clothes",
        "price": 0,
        "image_path": "/compressed_output/cloth_processed/no_outfit.webp",
        "rarity": "common",
        "is_default": True,
    },
    {
        "name": "Dress",
        "item_type": "clothes",
        "price": 350,
        "image_path": "/compressed_output/cloth_processed/dress.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Glasses",
        "item_type": "clothes",
        "price": 200,
        "image_path": "/compressed_output/cloth_processed/glasses.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Suit",
        "item_type": "clothes",
        "price": 450,
        "image_path": "/compressed_output/cloth_processed/suit.webp",
        "rarity": "rare",
        "is_default": False,
    },
    {
        "name": "Super Outfit",
        "item_type": "clothes",
        "price": 600,
        "image_path": "/compressed_output/cloth_processed/super_outfit.webp",
        "rarity": "epic",
        "is_default": False,
    },

    # === FURNITURE (35 items) ===
    {
        "name": "Bed",
        "item_type": "furniture",
        "price": 150,
        "image_path": "/compressed_output/furniture_processed/bed.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Bookshelf",
        "item_type": "furniture",
        "price": 200,
        "image_path": "/compressed_output/furniture_processed/bookshelf.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Chair",
        "item_type": "furniture",
        "price": 100,
        "image_path": "/compressed_output/furniture_processed/chair.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Clock",
        "item_type": "furniture",
        "price": 120,
        "image_path": "/compressed_output/furniture_processed/clock.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Desk",
        "item_type": "furniture",
        "price": 180,
        "image_path": "/compressed_output/furniture_processed/desk.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Door",
        "item_type": "furniture",
        "price": 220,
        "image_path": "/compressed_output/furniture_processed/door.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Drawer",
        "item_type": "furniture",
        "price": 140,
        "image_path": "/compressed_output/furniture_processed/drawer.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Globe",
        "item_type": "furniture",
        "price": 90,
        "image_path": "/compressed_output/furniture_processed/globe.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Guitar",
        "item_type": "furniture",
        "price": 300,
        "image_path": "/compressed_output/furniture_processed/guitar.webp",
        "rarity": "rare",
        "is_default": False,
    },
    {
        "name": "Lamp",
        "item_type": "furniture",
        "price": 80,
        "image_path": "/compressed_output/furniture_processed/lamp.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Laptop",
        "item_type": "furniture",
        "price": 400,
        "image_path": "/compressed_output/furniture_processed/laptop.webp",
        "rarity": "rare",
        "is_default": False,
    },
    {
        "name": "Mirror",
        "item_type": "furniture",
        "price": 110,
        "image_path": "/compressed_output/furniture_processed/mirror.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Mug",
        "item_type": "furniture",
        "price": 50,
        "image_path": "/compressed_output/furniture_processed/mug.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Notebook",
        "item_type": "furniture",
        "price": 60,
        "image_path": "/compressed_output/furniture_processed/notebook.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Painting",
        "item_type": "furniture",
        "price": 250,
        "image_path": "/compressed_output/furniture_processed/painting.webp",
        "rarity": "rare",
        "is_default": False,
    },
    {
        "name": "Pen Holder",
        "item_type": "furniture",
        "price": 70,
        "image_path": "/compressed_output/furniture_processed/pen_holder.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Pillow",
        "item_type": "furniture",
        "price": 80,
        "image_path": "/compressed_output/furniture_processed/pillow.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Plant",
        "item_type": "furniture",
        "price": 90,
        "image_path": "/compressed_output/furniture_processed/plant.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Poster",
        "item_type": "furniture",
        "price": 100,
        "image_path": "/compressed_output/furniture_processed/poster.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Rug",
        "item_type": "furniture",
        "price": 130,
        "image_path": "/compressed_output/furniture_processed/rug.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Shelf",
        "item_type": "furniture",
        "price": 160,
        "image_path": "/compressed_output/furniture_processed/shelf.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Sofa",
        "item_type": "furniture",
        "price": 350,
        "image_path": "/compressed_output/furniture_processed/sofa.webp",
        "rarity": "rare",
        "is_default": False,
    },
    {
        "name": "Speaker",
        "item_type": "furniture",
        "price": 180,
        "image_path": "/compressed_output/furniture_processed/speaker.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Table",
        "item_type": "furniture",
        "price": 170,
        "image_path": "/compressed_output/furniture_processed/table.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Telescope",
        "item_type": "furniture",
        "price": 500,
        "image_path": "/compressed_output/furniture_processed/telescope.webp",
        "rarity": "epic",
        "is_default": False,
    },
    {
        "name": "Trophy",
        "item_type": "furniture",
        "price": 280,
        "image_path": "/compressed_output/furniture_processed/trophy.webp",
        "rarity": "rare",
        "is_default": False,
    },
    {
        "name": "TV",
        "item_type": "furniture",
        "price": 450,
        "image_path": "/compressed_output/furniture_processed/tv.webp",
        "rarity": "rare",
        "is_default": False,
    },
    {
        "name": "Vase",
        "item_type": "furniture",
        "price": 95,
        "image_path": "/compressed_output/furniture_processed/vase.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Whiteboard",
        "item_type": "furniture",
        "price": 200,
        "image_path": "/compressed_output/furniture_processed/whiteboard.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Window",
        "item_type": "furniture",
        "price": 150,
        "image_path": "/compressed_output/furniture_processed/window.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Wine Bottle",
        "item_type": "furniture",
        "price": 120,
        "image_path": "/compressed_output/furniture_processed/wine_bottle.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Bean Bag",
        "item_type": "furniture",
        "price": 180,
        "image_path": "/compressed_output/furniture_processed/bean_bag.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Cactus",
        "item_type": "furniture",
        "price": 85,
        "image_path": "/compressed_output/furniture_processed/cactus.webp",
        "rarity": "common",
        "is_default": False,
    },
    {
        "name": "Fish Tank",
        "item_type": "furniture",
        "price": 320,
        "image_path": "/compressed_output/furniture_processed/fish_tank.webp",
        "rarity": "rare",
        "is_default": False,
    },
    {
        "name": "Game Console",
        "item_type": "furniture",
        "price": 480,
        "image_path": "/compressed_output/furniture_processed/game_console.webp",
        "rarity": "epic",
        "is_default": False,
    },
]


async def main() -> None:
    """Seed shop items."""
    print("🌱 Seeding shop items...")

    async for db in get_db_session():
        try:
            result = await ShopService.seed_initial_items(
                db=db,
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

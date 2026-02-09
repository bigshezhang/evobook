"""Seed discovery courses based on frontend mock data.

This script populates the discovery_courses table with curated courses
that match the frontend UI mockups.
"""

import asyncio
import sys
from pathlib import Path
from uuid import uuid4

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.models.discovery_course import DiscoveryCourse
from app.infrastructure.database import get_async_session_maker


# Discovery courses matching frontend mockCourses
DISCOVERY_COURSES = [
    {
        "preset_id": "quantum-physics-intro",
        "title": "Quantum Physics for Beginners",
        "description": "Explore the fascinating world of quantum mechanics through intuitive explanations and thought experiments. Perfect for curious minds with no physics background.",
        "image_url": "https://lh3.googleusercontent.com/aida-public/AB6AXuBVh0Klh6NP9xJlGoCDBYhLviF2v7kGDywuB2iqsR5JNGI77a5jPKpTPYbkMMje-F3pG_KNuL5u_N9-BOuwNUhahvEaRP8Vqr2uJmDeHVnbiJ9JkBjIvRAzDwvr_5uEJF6I7Tr8gW-yVtUGneFoqwThw77OSJboIaADXg4g3G5kWw27D620BJXojoH6XjH_JHIgnR5fHFAfxsYgmA-dRdvovRH2WqenhXO-X_RM7b0HpUvuNEqz0ReqexuKlaDGKkjHpjS1he3E_4VN",
        "category": "recommended",
        "display_order": 1,
        "rating": "4.9",
        "seed_context": {
            "topic": "Quantum Physics",
            "suggested_level": "Beginner",
            "key_concepts": "wave-particle duality, superposition, uncertainty principle, quantum entanglement",
            "focus": "Understanding fundamental principles and famous thought experiments like Schrödinger's cat",
            "verified_concept": "Schrödinger's cat thought experiment",
        },
    },
    {
        "preset_id": "modern-ui-principles",
        "title": "Modern UI Principles",
        "description": "Master contemporary UI design principles used by top tech companies. Learn to create beautiful, accessible, and user-friendly interfaces.",
        "image_url": "https://lh3.googleusercontent.com/aida-public/AB6AXuDfyFpDVnX6bPRc7_brb8I3gZvDk5WlJpC2yBr0BdFC7YfNhCKeBuCR7vGACtp_fM-lvmVaQ3MvxTOVcfbKl69niLhNsvv9MUEPdyLYCtkeZK4YqqClWbMizn5pFcy6r1mwoBd389LYHrzCYZXsggF4ZrYkDh49bCW12VwKzL8aQC50EaL2C68uIybYjsd8tO2B6ItBD52q3tDXczyvK6fMHAR9dJ4iZIHf_2C1QjLJBf5G7Z8So-J6vMvjGXyjS4FDfUoEKUE3KHo8",
        "category": "recommended",
        "display_order": 2,
        "rating": "4.7",
        "seed_context": {
            "topic": "UI Design",
            "suggested_level": "Beginner",
            "key_concepts": "visual hierarchy, spacing systems, typography, color theory, design tokens",
            "focus": "Building modern, accessible interfaces with strong visual hierarchy",
            "verified_concept": "8-point grid system",
        },
    },
    {
        "preset_id": "neural-architecture",
        "title": "Neural Architecture",
        "description": "Deep dive into neural network architectures. Understand transformers, CNNs, RNNs, and how to design networks for specific tasks.",
        "image_url": "https://lh3.googleusercontent.com/aida-public/AB6AXuBVh0Klh6NP9xJlGoCDBYhLviF2v7kGDywuB2iqsR5JNGI77a5jPKpTPYbkMMje-F3pG_KNuL5u_N9-BOuwNUhahvEaRP8Vqr2uJmDeHVnbiJ9JkBjIvRAzDwvr_5uEJF6I7Tr8gW-yVtUGneFoqwThw77OSJboIaADXg4g3G5kWw27D620BJXojoH6XjH_JHIgnR5fHFAfxsYgmA-dRdvovRH2WqenhXO-X_RM7b0HpUvuNEqz0ReqexuKlaDGKkjHpjS1he3E_4VN",
        "category": "recommended",
        "display_order": 3,
        "rating": "4.9",
        "seed_context": {
            "topic": "Neural Network Architecture",
            "suggested_level": "Advanced",
            "key_concepts": "transformers, attention mechanism, CNNs, RNNs, residual connections",
            "focus": "Designing and implementing neural network architectures for real-world applications",
            "verified_concept": "self-attention mechanism in transformers",
        },
    },
    {
        "preset_id": "creative-coding-101",
        "title": "Creative Coding 101",
        "description": "Express your creativity through code. Learn p5.js, Processing, or similar tools to create interactive visual experiences.",
        "image_url": "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&q=80&w=400",
        "category": "recommended",
        "display_order": 4,
        "rating": "4.5",
        "seed_context": {
            "topic": "Creative Coding",
            "suggested_level": "Beginner",
            "key_concepts": "p5.js, canvas API, animation loops, interactive graphics, generative patterns",
            "focus": "Creating interactive visual art and animations using code",
            "verified_concept": "draw loop in p5.js",
        },
    },
    {
        "preset_id": "generative-art-ai",
        "title": "Generative Art AI",
        "description": "Discover how AI transforms creative expression. Learn to create stunning visual art using diffusion models and creative coding techniques.",
        "image_url": "https://lh3.googleusercontent.com/aida-public/AB6AXuD7eD8fqZiz9LF_Ll3fcoZ4q2Hqvmzqpi7PwKaLjlRQTDUEF3Sp4cttbewU6EnbiOaoOHX5c5Is0fTMbIyPcw79WY0EWZBbQ97QbQtv-frVlBaNqRWXNWzwApZ8pp46xTyIX5Qi80odWX6IvSXgOk6uDzszDZejO-QTMh-HnICw62HutK9NE_yC3mrBDW7o8hkbpdgE4cWAAkhWhGdFeXCQuY6Alt8pVMkpLu77g78HtsxNLh3ssbnBkEk1c2AuKGa4cWksbCAMhpku",
        "category": "popular",
        "display_order": 1,
        "rating": "4.8",
        "seed_context": {
            "topic": "Generative Art with AI",
            "suggested_level": "Intermediate",
            "key_concepts": "diffusion models, prompt engineering, style transfer, latent space",
            "focus": "Creating unique visual art through AI-powered generative techniques",
            "verified_concept": "Stable Diffusion",
        },
    },
    {
        "preset_id": "data-science-flow",
        "title": "Data Science Flow",
        "description": "Build complete data science pipelines from raw data to insights. Learn Python, pandas, and machine learning fundamentals.",
        "image_url": "https://lh3.googleusercontent.com/aida-public/AB6AXuDNckK3K3HSkhpzQSVZHPYymsoJ0u8gm1yPi10mo0wStcEj4-7dZG1bILE4rC26eIQeidX23gTSAomuuIdBTQcsQPUo-6NhA5BtSppLaGvtnSGRXN9q2ToMiVLItW_gstbmp8PSd3PNnlXgnd7ICmbVR7Qyy72hClRGspmcZ2N1FjwF4z79e8jpLpJZ05HeST0AA4nbtnmj5D-TyZZmPRLWM-OFKH-V4qA6HZFU1N6-7XvSqG1gaecWd6tQ---Siy8btKsTKNNGXl4A",
        "category": "popular",
        "display_order": 2,
        "rating": "4.6",
        "seed_context": {
            "topic": "Data Science",
            "suggested_level": "Beginner",
            "key_concepts": "pandas, data cleaning, exploratory data analysis, basic machine learning",
            "focus": "Building end-to-end data science workflows from data collection to insights",
            "verified_concept": "DataFrame operations in pandas",
        },
    },
    {
        "preset_id": "blockchain-fundamentals",
        "title": "Blockchain Fundamentals",
        "description": "Understand blockchain technology from the ground up. Learn about distributed ledgers, consensus mechanisms, and smart contracts.",
        "image_url": "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&q=80&w=400",
        "category": "popular",
        "display_order": 3,
        "rating": "4.7",
        "seed_context": {
            "topic": "Blockchain Technology",
            "suggested_level": "Intermediate",
            "key_concepts": "distributed ledgers, proof of work, proof of stake, smart contracts, cryptographic hashing",
            "focus": "Understanding the core principles of blockchain and decentralized systems",
            "verified_concept": "consensus mechanisms",
        },
    },
    {
        "preset_id": "ux-research-methods",
        "title": "UX Research Methods",
        "description": "Master user research techniques to build products people love. Learn user interviews, usability testing, and data-driven design decisions.",
        "image_url": "https://images.unsplash.com/photo-1556761175-4b46a572b786?auto=format&fit=crop&q=80&w=400",
        "category": "popular",
        "display_order": 4,
        "rating": "4.8",
        "seed_context": {
            "topic": "UX Research",
            "suggested_level": "Beginner",
            "key_concepts": "user interviews, usability testing, personas, journey mapping, A/B testing",
            "focus": "Conducting effective user research to inform product design decisions",
            "verified_concept": "user interview techniques",
        },
    },
]


async def seed_discovery_courses(db: AsyncSession) -> None:
    """Seed discovery courses into database.

    Args:
        db: Database session.
    """
    print("Seeding discovery courses...")

    for course_data in DISCOVERY_COURSES:
        # Check if course already exists
        stmt = select(DiscoveryCourse).where(
            DiscoveryCourse.preset_id == course_data["preset_id"]
        )
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            # Update existing course
            existing.category = course_data["category"]
            existing.display_order = course_data["display_order"]
            existing.title = course_data["title"]
            existing.description = course_data["description"]
            existing.image_url = course_data["image_url"]
            existing.rating = course_data["rating"]
            existing.seed_context = course_data["seed_context"]
            print(f"🔄 Updated: {course_data['title']}")
            continue

        # Create new course
        course = DiscoveryCourse(
            id=uuid4(),
            preset_id=course_data["preset_id"],
            title=course_data["title"],
            description=course_data["description"],
            image_url=course_data["image_url"],
            category=course_data["category"],
            display_order=course_data["display_order"],
            rating=course_data["rating"],
            seed_context=course_data["seed_context"],
            is_active=True,
            view_count=0,
            start_count=0,
            completion_count=0,
        )
        db.add(course)
        print(f"✅ Added: {course_data['title']}")

    await db.commit()
    print(f"\n✨ Seeding complete! Added {len(DISCOVERY_COURSES)} discovery courses.")


async def main() -> None:
    """Main entry point."""
    async_session_maker = get_async_session_maker()
    async with async_session_maker() as db:
        await seed_discovery_courses(db)


if __name__ == "__main__":
    asyncio.run(main())

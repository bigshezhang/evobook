#!/usr/bin/env python3
"""End-to-end test script for EvoBook API flow.

This script validates the complete user journey:
1. Onboarding (multi-turn conversation until finish)
2. Course map (DAG) generation
3. Knowledge card generation
4. Quiz generation

Usage:
    # Run against local server (requires server running)
    python3 scripts/e2e_run.py

    # Run with mock LLM (set env var before starting server)
    MOCK_LLM=1 python3 scripts/e2e_run.py

    # Specify custom API base URL
    API_BASE_URL=http://localhost:8000 python3 scripts/e2e_run.py
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx

# Configuration
BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")
OUT_DIR = Path(__file__).parent.parent / ".out"
TIMEOUT = 120.0  # Longer timeout for LLM calls


def save_output(name: str, data: dict[str, Any]) -> Path:
    """Save response data to .out/ directory.
    
    Args:
        name: Output filename (without extension).
        data: Response data to save.
        
    Returns:
        Path to the saved file.
    """
    OUT_DIR.mkdir(exist_ok=True)
    filepath = OUT_DIR / f"{name}.json"
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    return filepath


def run_onboarding(client: httpx.Client) -> dict[str, Any]:
    """Run onboarding flow until finish.
    
    Simulates a user going through the onboarding conversation by
    selecting predefined choices for each step.
    
    Args:
        client: HTTP client instance.
        
    Returns:
        Final onboarding result with user profile data.
        
    Raises:
        RuntimeError: If onboarding fails or times out.
    """
    # Predefined choices for each onboarding step
    choices = [
        None,  # Initial request - no choice
        "Python 编程",  # Topic selection
        "完全没听过",  # Calibration R1
        "完全零基础",  # Calibration R2
        "能独立写小程序",  # Focus
        "朋友推荐",  # Source
    ]
    
    session_id = None
    result = None
    
    for i, choice in enumerate(choices):
        payload: dict[str, Any] = {"session_id": session_id}
        if choice:
            payload["user_choice"] = choice
        
        response = client.post(
            f"{BASE_URL}/api/v1/onboarding/next",
            json=payload,
            timeout=TIMEOUT,
        )
        response.raise_for_status()
        result = response.json()
        
        session_id = result.get("session_id")
        
        print(f"    Step {i + 1}: {result.get('type')} - {result.get('message', '')[:50]}...")
        
        if result.get("type") == "finish":
            return result
    
    # If we didn't get finish, try one more request
    response = client.post(
        f"{BASE_URL}/api/v1/onboarding/next",
        json={"session_id": session_id},
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    result = response.json()
    
    if result.get("type") == "finish":
        return result
    
    raise RuntimeError(f"Onboarding did not finish after {len(choices) + 1} steps")


def run_course_map(client: httpx.Client, onboarding_data: dict[str, Any]) -> dict[str, Any]:
    """Generate course map from onboarding data.
    
    Args:
        client: HTTP client instance.
        onboarding_data: User profile from onboarding (the 'data' field).
        
    Returns:
        Course map with map_meta and nodes.
    """
    payload = {
        "topic": onboarding_data["topic"],
        "level": onboarding_data["level"],
        "focus": onboarding_data["focus"],
        "verified_concept": onboarding_data["verified_concept"],
        "mode": "Fast",  # Use Fast mode for testing
        "total_commitment_minutes": 120,
    }
    
    response = client.post(
        f"{BASE_URL}/api/v1/course-map/generate",
        json=payload,
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    return response.json()


def run_knowledge_card(client: httpx.Client, course_map: dict[str, Any]) -> dict[str, Any]:
    """Generate knowledge card for the first learn node.
    
    Args:
        client: HTTP client instance.
        course_map: Course map with nodes.
        
    Returns:
        Knowledge card response with markdown and yaml.
    """
    # Find first learn node
    learn_nodes = [n for n in course_map["nodes"] if n["type"] == "learn"]
    if not learn_nodes:
        raise RuntimeError("No learn nodes found in course map")
    
    first_node = learn_nodes[0]
    map_meta = course_map["map_meta"]
    
    payload = {
        "course": {
            "course_name": map_meta["course_name"],
            "course_context": map_meta["strategy_rationale"],
            "topic": "Python 编程",  # From onboarding
            "level": "Beginner",
            "mode": map_meta["mode"],
        },
        "node": {
            "id": first_node["id"],
            "title": first_node["title"],
            "description": first_node["description"],
            "type": first_node["type"],
            "estimated_minutes": first_node["estimated_minutes"],
        },
    }
    
    response = client.post(
        f"{BASE_URL}/api/v1/node-content/knowledge-card",
        json=payload,
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    return response.json()


def run_quiz(client: httpx.Client, knowledge_card: dict[str, Any]) -> dict[str, Any]:
    """Generate quiz from learned content.
    
    Args:
        client: HTTP client instance.
        knowledge_card: Knowledge card with markdown content.
        
    Returns:
        Quiz response with questions.
    """
    payload = {
        "language": "zh",
        "mode": "Fast",
        "learned_topics": [
            {
                "topic_name": "Python 基础入门",
                "pages_markdown": knowledge_card["markdown"],
            }
        ],
    }
    
    response = client.post(
        f"{BASE_URL}/api/v1/quiz/generate",
        json=payload,
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    return response.json()


def check_health(client: httpx.Client) -> bool:
    """Check if the API server is healthy.
    
    Args:
        client: HTTP client instance.
        
    Returns:
        True if healthy, False otherwise.
    """
    try:
        response = client.get(f"{BASE_URL}/healthz", timeout=5.0)
        return response.status_code == 200 and response.json().get("ok") is True
    except Exception:
        return False


def print_summary(results: dict[str, Any]) -> None:
    """Print execution summary.
    
    Args:
        results: Dictionary with all step results.
    """
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    # Onboarding
    onboarding = results.get("onboarding", {})
    onboarding_data = onboarding.get("data", {})
    print(f"\n📚 Onboarding:")
    print(f"   Topic: {onboarding_data.get('topic', 'N/A')}")
    print(f"   Level: {onboarding_data.get('level', 'N/A')}")
    print(f"   Focus: {onboarding_data.get('focus', 'N/A')}")
    
    # Course Map
    course_map = results.get("course_map", {})
    map_meta = course_map.get("map_meta", {})
    nodes = course_map.get("nodes", [])
    print(f"\n🗺️  Course Map:")
    print(f"   Name: {map_meta.get('course_name', 'N/A')}")
    print(f"   Nodes: {len(nodes)}")
    print(f"   Total Time: {map_meta.get('time_sum_minutes', 0)} min")
    print(f"   Node Types: {', '.join(set(n.get('type', '') for n in nodes))}")
    
    # Knowledge Card
    knowledge_card = results.get("knowledge_card", {})
    print(f"\n📄 Knowledge Card:")
    print(f"   Pages: {knowledge_card.get('totalPagesInCard', 0)}")
    print(f"   Markdown Length: {len(knowledge_card.get('markdown', ''))} chars")
    
    # Quiz
    quiz = results.get("quiz", {})
    questions = quiz.get("questions", [])
    print(f"\n❓ Quiz:")
    print(f"   Title: {quiz.get('title', 'N/A')}")
    print(f"   Questions: {len(questions)}")
    if questions:
        qtypes = [q.get("qtype", "") for q in questions]
        print(f"   Question Types: {', '.join(set(qtypes))}")


def main() -> int:
    """Run the complete e2e flow.
    
    Returns:
        Exit code (0 for success, 1 for failure).
    """
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    print("=" * 60)
    print("EvoBook E2E Test")
    print("=" * 60)
    print(f"  Timestamp: {timestamp}")
    print(f"  API Base URL: {BASE_URL}")
    print(f"  Output Dir: {OUT_DIR.absolute()}")
    
    results: dict[str, Any] = {}
    
    with httpx.Client() as client:
        # Health check
        print("\n[0/4] Checking API health...")
        if not check_health(client):
            print("  ✗ API is not healthy. Make sure the server is running:")
            print(f"    uv run uvicorn app.main:app --reload --port 8000")
            return 1
        print("  ✓ API is healthy")
        
        try:
            # Step 1: Onboarding
            print("\n[1/4] Running onboarding...")
            onboarding_result = run_onboarding(client)
            save_output("1_onboarding", onboarding_result)
            results["onboarding"] = onboarding_result
            print(f"  ✓ Onboarding complete: topic={onboarding_result['data']['topic']}")
            
            # Step 2: Course Map (DAG)
            print("\n[2/4] Generating course map...")
            course_map = run_course_map(client, onboarding_result["data"])
            save_output("2_course_map", course_map)
            results["course_map"] = course_map
            print(f"  ✓ Course map: {len(course_map['nodes'])} nodes, {course_map['map_meta']['time_sum_minutes']} minutes")
            
            # Step 3: Knowledge Card
            print("\n[3/4] Generating knowledge card...")
            knowledge_card = run_knowledge_card(client, course_map)
            save_output("3_knowledge_card", knowledge_card)
            results["knowledge_card"] = knowledge_card
            print(f"  ✓ Knowledge card: {knowledge_card['totalPagesInCard']} pages")
            
            # Step 4: Quiz
            print("\n[4/4] Generating quiz...")
            quiz = run_quiz(client, knowledge_card)
            save_output("4_quiz", quiz)
            results["quiz"] = quiz
            print(f"  ✓ Quiz: {len(quiz['questions'])} questions")
            
        except httpx.HTTPStatusError as e:
            print(f"\n  ✗ HTTP Error: {e.response.status_code}")
            print(f"    Response: {e.response.text}")
            return 1
        except Exception as e:
            print(f"\n  ✗ Error: {e}")
            return 1
    
    # Print summary
    print_summary(results)
    
    # Save combined results
    save_output("e2e_results", {
        "timestamp": timestamp,
        "api_base_url": BASE_URL,
        "success": True,
        "results": results,
    })
    
    print("\n" + "=" * 60)
    print("E2E Test Complete!")
    print(f"Results saved to: {OUT_DIR.absolute()}")
    print("=" * 60)
    
    return 0


if __name__ == "__main__":
    sys.exit(main())

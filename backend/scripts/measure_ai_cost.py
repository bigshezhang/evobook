#!/usr/bin/env python3
"""Measure AI cost for a complete course generation flow.

This script runs the full e2e flow and calculates the actual AI cost
based on token usage from Gemini 1.5 Flash.

Gemini 1.5 Flash Pricing (as of 2024):
- Input: $0.075 per 1M tokens
- Output: $0.30 per 1M tokens

Usage:
    # Make sure the server is running with real LLM (not MOCK_LLM)
    python3 scripts/measure_ai_cost.py
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
OUT_DIR = Path(__file__).parent.parent / ".out" / "cost_measurement"
TIMEOUT = 120.0

# Gemini 1.5 Flash Pricing (USD per 1M tokens)
INPUT_COST_PER_1M = 0.075
OUTPUT_COST_PER_1M = 0.30
USD_TO_CNY = 7.2  # Approximate exchange rate


class TokenTracker:
    """Track token usage across all LLM calls."""
    
    def __init__(self):
        self.calls = []
        self.total_input_tokens = 0
        self.total_output_tokens = 0
    
    def add_call(self, name: str, input_tokens: int, output_tokens: int):
        """Add a call to the tracker."""
        self.calls.append({
            "name": name,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "cost_usd": self._calculate_cost(input_tokens, output_tokens)
        })
        self.total_input_tokens += input_tokens
        self.total_output_tokens += output_tokens
    
    def _calculate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """Calculate cost in USD for a single call."""
        input_cost = (input_tokens / 1_000_000) * INPUT_COST_PER_1M
        output_cost = (output_tokens / 1_000_000) * OUTPUT_COST_PER_1M
        return input_cost + output_cost
    
    @property
    def total_cost_usd(self) -> float:
        """Get total cost in USD."""
        return self._calculate_cost(self.total_input_tokens, self.total_output_tokens)
    
    @property
    def total_cost_cny(self) -> float:
        """Get total cost in CNY."""
        return self.total_cost_usd * USD_TO_CNY
    
    def get_summary(self) -> dict:
        """Get cost summary."""
        return {
            "total_input_tokens": self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
            "total_tokens": self.total_input_tokens + self.total_output_tokens,
            "total_cost_usd": round(self.total_cost_usd, 4),
            "total_cost_cny": round(self.total_cost_cny, 4),
            "calls": self.calls,
            "breakdown": {
                "input_cost_usd": round((self.total_input_tokens / 1_000_000) * INPUT_COST_PER_1M, 4),
                "output_cost_usd": round((self.total_output_tokens / 1_000_000) * OUTPUT_COST_PER_1M, 4),
            }
        }


def extract_token_usage(response_data: dict) -> tuple[int, int]:
    """Extract token usage from API response if available.
    
    Note: This requires the API to return token usage in the response.
    If not available, returns (0, 0) and we'll need to estimate.
    """
    # Check if response includes usage metadata
    usage = response_data.get("_usage", {})
    if usage:
        return usage.get("input_tokens", 0), usage.get("output_tokens", 0)
    
    # Fallback: estimate based on content length
    # This is a rough estimate: ~1 token ≈ 4 characters for English, ~1.5 chars for Chinese
    return 0, 0


def save_output(name: str, data: dict[str, Any]) -> Path:
    """Save response data to .out/cost_measurement/ directory."""
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    filepath = OUT_DIR / f"{name}.json"
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    return filepath


def run_onboarding(client: httpx.Client, tracker: TokenTracker) -> dict[str, Any]:
    """Run onboarding flow and track tokens."""
    choices = [
        None,  # Initial request
        "Python 编程",
        "完全没听过",
        "完全零基础",
        "能独立写小程序",
        "朋友推荐",
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
        
        # Try to extract token usage
        input_tokens, output_tokens = extract_token_usage(result)
        if input_tokens > 0 or output_tokens > 0:
            tracker.add_call(f"onboarding_step_{i+1}", input_tokens, output_tokens)
        
        print(f"    Step {i + 1}: {result.get('type')}")
        
        if result.get("type") == "finish":
            return result
    
    # Final request if needed
    response = client.post(
        f"{BASE_URL}/api/v1/onboarding/next",
        json={"session_id": session_id},
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    result = response.json()
    
    input_tokens, output_tokens = extract_token_usage(result)
    if input_tokens > 0 or output_tokens > 0:
        tracker.add_call("onboarding_final", input_tokens, output_tokens)
    
    if result.get("type") == "finish":
        return result
    
    raise RuntimeError("Onboarding did not finish")


def run_course_map(client: httpx.Client, tracker: TokenTracker, onboarding_data: dict) -> dict:
    """Generate course map and track tokens."""
    payload = {
        "topic": onboarding_data["topic"],
        "level": onboarding_data["level"],
        "focus": onboarding_data["focus"],
        "verified_concept": onboarding_data["verified_concept"],
        "mode": "Fast",
        "total_commitment_minutes": 120,
    }
    
    response = client.post(
        f"{BASE_URL}/api/v1/course-map/generate",
        json=payload,
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    result = response.json()
    
    input_tokens, output_tokens = extract_token_usage(result)
    if input_tokens > 0 or output_tokens > 0:
        tracker.add_call("course_map_generation", input_tokens, output_tokens)
    
    return result


def run_knowledge_card(client: httpx.Client, tracker: TokenTracker, course_map: dict) -> dict:
    """Generate knowledge card and track tokens."""
    learn_nodes = [n for n in course_map["nodes"] if n["type"] == "learn"]
    if not learn_nodes:
        raise RuntimeError("No learn nodes found")
    
    first_node = learn_nodes[0]
    map_meta = course_map["map_meta"]
    
    payload = {
        "course": {
            "course_name": map_meta["course_name"],
            "course_context": map_meta["strategy_rationale"],
            "topic": "Python 编程",
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
    result = response.json()
    
    input_tokens, output_tokens = extract_token_usage(result)
    if input_tokens > 0 or output_tokens > 0:
        tracker.add_call("knowledge_card", input_tokens, output_tokens)
    
    return result


def run_clarification(client: httpx.Client, tracker: TokenTracker, knowledge_card: dict) -> dict:
    """Generate clarification and track tokens."""
    # Extract first page from markdown
    markdown = knowledge_card.get("markdown", "")
    first_page = markdown.split("<EVOBK_PAGE_BREAK")[0] if markdown else ""
    
    payload = {
        "language": "zh",
        "user_question_raw": "什么是变量？",
        "page_markdown": first_page,
    }
    
    response = client.post(
        f"{BASE_URL}/api/v1/node-content/clarification",
        json=payload,
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    result = response.json()
    
    input_tokens, output_tokens = extract_token_usage(result)
    if input_tokens > 0 or output_tokens > 0:
        tracker.add_call("clarification", input_tokens, output_tokens)
    
    return result


def run_qa_detail(client: httpx.Client, tracker: TokenTracker, clarification: dict) -> dict:
    """Generate QA detail and track tokens."""
    payload = {
        "language": "zh",
        "qa_title": clarification.get("corrected_title", "什么是变量？"),
        "qa_short_answer": clarification.get("short_answer", ""),
    }
    
    response = client.post(
        f"{BASE_URL}/api/v1/node-content/qa-detail",
        json=payload,
        timeout=TIMEOUT,
    )
    response.raise_for_status()
    result = response.json()
    
    input_tokens, output_tokens = extract_token_usage(result)
    if input_tokens > 0 or output_tokens > 0:
        tracker.add_call("qa_detail", input_tokens, output_tokens)
    
    return result


def run_quiz(client: httpx.Client, tracker: TokenTracker, knowledge_card: dict) -> dict:
    """Generate quiz and track tokens."""
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
    result = response.json()
    
    input_tokens, output_tokens = extract_token_usage(result)
    if input_tokens > 0 or output_tokens > 0:
        tracker.add_call("quiz", input_tokens, output_tokens)
    
    return result


def check_health(client: httpx.Client) -> bool:
    """Check if the API server is healthy."""
    try:
        response = client.get(f"{BASE_URL}/healthz", timeout=5.0)
        return response.status_code == 200
    except Exception:
        return False


def print_cost_report(tracker: TokenTracker, course_map: dict):
    """Print detailed cost report."""
    summary = tracker.get_summary()
    nodes = course_map.get("nodes", [])
    learn_nodes = [n for n in nodes if n["type"] == "learn"]
    
    print("\n" + "=" * 70)
    print("AI COST MEASUREMENT REPORT")
    print("=" * 70)
    
    print("\n📊 Token Usage:")
    print(f"   Input Tokens:  {summary['total_input_tokens']:,}")
    print(f"   Output Tokens: {summary['total_output_tokens']:,}")
    print(f"   Total Tokens:  {summary['total_tokens']:,}")
    
    print("\n💰 Cost Breakdown:")
    print(f"   Input Cost:    ${summary['breakdown']['input_cost_usd']:.4f} (¥{summary['breakdown']['input_cost_usd'] * USD_TO_CNY:.4f})")
    print(f"   Output Cost:   ${summary['breakdown']['output_cost_usd']:.4f} (¥{summary['breakdown']['output_cost_usd'] * USD_TO_CNY:.4f})")
    print(f"   Total Cost:    ${summary['total_cost_usd']:.4f} (¥{summary['total_cost_cny']:.4f})")
    
    print("\n📝 Per-Call Breakdown:")
    for call in summary['calls']:
        print(f"   {call['name']:<25} ${call['cost_usd']:.4f} ({call['input_tokens']:,} in / {call['output_tokens']:,} out)")
    
    print("\n📈 Extrapolation to Full Course:")
    print(f"   Course has {len(learn_nodes)} learn nodes")
    print(f"   Measured 1 knowledge card")
    if len(learn_nodes) > 1:
        # Estimate cost for all learn nodes
        knowledge_card_cost = next((c['cost_usd'] for c in summary['calls'] if 'knowledge_card' in c['name']), 0)
        total_knowledge_cards_cost = knowledge_card_cost * len(learn_nodes)
        
        # Add other one-time costs
        other_costs = summary['total_cost_usd'] - knowledge_card_cost
        estimated_full_cost_usd = total_knowledge_cards_cost + other_costs
        estimated_full_cost_cny = estimated_full_cost_usd * USD_TO_CNY
        
        print(f"   Estimated Full Course Cost: ${estimated_full_cost_usd:.4f} (¥{estimated_full_cost_cny:.2f})")
        
        print("\n💡 Pricing Recommendation:")
        print(f"   AI Cost per Course: ¥{estimated_full_cost_cny:.2f}")
        print(f"   Suggested Markup: 10-20x for SaaS (industry standard)")
        print(f"   Min Price per Course: ¥{estimated_full_cost_cny * 10:.0f}")
        print(f"   Recommended Price: ¥{estimated_full_cost_cny * 15:.0f}")
    
    print("\n🎯 Monthly Subscription Cost Estimates:")
    course_costs = {
        3: summary['total_cost_cny'] * 3,
        15: summary['total_cost_cny'] * 15,
        50: summary['total_cost_cny'] * 50,
    }
    
    for num_courses, cost in course_costs.items():
        print(f"   {num_courses:3d} courses/month: ¥{cost:.2f} AI cost")
        # Suggested retail price with markup
        markup = 10 if num_courses <= 3 else 8 if num_courses <= 15 else 6
        suggested_price = cost * markup
        gross_margin = ((suggested_price - cost) / suggested_price) * 100
        print(f"       → Suggested price: ¥{suggested_price:.0f} (Gross margin: {gross_margin:.0f}%)")


def main() -> int:
    """Run cost measurement."""
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    print("=" * 70)
    print("EvoBook AI Cost Measurement")
    print("=" * 70)
    print(f"  Timestamp: {timestamp}")
    print(f"  API Base URL: {BASE_URL}")
    print(f"  Model: Gemini 1.5 Flash")
    print(f"  Input Cost: ${INPUT_COST_PER_1M} per 1M tokens")
    print(f"  Output Cost: ${OUTPUT_COST_PER_1M} per 1M tokens")
    print(f"  Exchange Rate: 1 USD = {USD_TO_CNY} CNY")
    
    tracker = TokenTracker()
    results = {}
    
    with httpx.Client() as client:
        print("\n[0/6] Checking API health...")
        if not check_health(client):
            print("  ✗ API is not healthy. Make sure the server is running with real LLM:")
            print("    (NOT MOCK_LLM=1)")
            print("    uv run uvicorn app.main:app --reload --port 8000")
            return 1
        print("  ✓ API is healthy")
        
        try:
            # Step 1: Onboarding
            print("\n[1/6] Running onboarding...")
            onboarding_result = run_onboarding(client, tracker)
            save_output("1_onboarding", onboarding_result)
            results["onboarding"] = onboarding_result
            print(f"  ✓ Onboarding complete")
            
            # Step 2: Course Map
            print("\n[2/6] Generating course map...")
            course_map = run_course_map(client, tracker, onboarding_result["data"])
            save_output("2_course_map", course_map)
            results["course_map"] = course_map
            print(f"  ✓ Course map: {len(course_map['nodes'])} nodes")
            
            # Step 3: Knowledge Card
            print("\n[3/6] Generating knowledge card...")
            knowledge_card = run_knowledge_card(client, tracker, course_map)
            save_output("3_knowledge_card", knowledge_card)
            results["knowledge_card"] = knowledge_card
            print(f"  ✓ Knowledge card generated")
            
            # Step 4: Clarification
            print("\n[4/6] Generating clarification...")
            clarification = run_clarification(client, tracker, knowledge_card)
            save_output("4_clarification", clarification)
            results["clarification"] = clarification
            print(f"  ✓ Clarification generated")
            
            # Step 5: QA Detail
            print("\n[5/6] Generating QA detail...")
            qa_detail = run_qa_detail(client, tracker, clarification)
            save_output("5_qa_detail", qa_detail)
            results["qa_detail"] = qa_detail
            print(f"  ✓ QA detail generated")
            
            # Step 6: Quiz
            print("\n[6/6] Generating quiz...")
            quiz = run_quiz(client, tracker, knowledge_card)
            save_output("6_quiz", quiz)
            results["quiz"] = quiz
            print(f"  ✓ Quiz: {len(quiz['questions'])} questions")
            
        except httpx.HTTPStatusError as e:
            print(f"\n  ✗ HTTP Error: {e.response.status_code}")
            print(f"    Response: {e.response.text}")
            return 1
        except Exception as e:
            print(f"\n  ✗ Error: {e}")
            import traceback
            traceback.print_exc()
            return 1
    
    # Print cost report
    print_cost_report(tracker, results.get("course_map", {}))
    
    # Save full report
    report = {
        "timestamp": timestamp,
        "api_base_url": BASE_URL,
        "model": "gemini-1.5-flash",
        "pricing": {
            "input_cost_per_1m_tokens_usd": INPUT_COST_PER_1M,
            "output_cost_per_1m_tokens_usd": OUTPUT_COST_PER_1M,
            "usd_to_cny": USD_TO_CNY,
        },
        "cost_summary": tracker.get_summary(),
        "results": results,
    }
    save_output("cost_report", report)
    
    print("\n" + "=" * 70)
    print("✅ Cost Measurement Complete!")
    print(f"Full report saved to: {OUT_DIR.absolute()}/cost_report.json")
    print("=" * 70)
    
    return 0


if __name__ == "__main__":
    sys.exit(main())

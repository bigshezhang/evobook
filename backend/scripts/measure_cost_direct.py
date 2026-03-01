#!/usr/bin/env python3
"""Direct AI cost measurement without HTTP server.

This script directly calls the LLM client to measure token usage and cost
for a complete course generation flow.

Gemini 1.5 Flash Pricing (as of 2024):
- Input: $0.075 per 1M tokens  
- Output: $0.30 per 1M tokens

Usage:
    python3 scripts/measure_cost_direct.py
"""

import asyncio
import os
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import Settings
from app.llm.client import LLMClient, OutputFormat

# Gemini 1.5 Flash Pricing (USD per 1M tokens)
INPUT_COST_PER_1M = 0.075
OUTPUT_COST_PER_1M = 0.30
USD_TO_CNY = 7.2


class CostTracker:
    """Track costs across all LLM calls."""
    
    def __init__(self):
        self.calls = []
        self.total_input_tokens = 0
        self.total_output_tokens = 0
    
    def add_response(self, name: str, response):
        """Add an LLM response to tracking."""
        self.calls.append({
            "name": name,
            "input_tokens": response.input_tokens,
            "output_tokens": response.output_tokens,
            "total_tokens": response.total_tokens,
            "latency_ms": response.latency_ms,
        })
        self.total_input_tokens += response.input_tokens
        self.total_output_tokens += response.output_tokens
    
    def calculate_cost_usd(self) -> float:
        """Calculate total cost in USD."""
        input_cost = (self.total_input_tokens / 1_000_000) * INPUT_COST_PER_1M
        output_cost = (self.total_output_tokens / 1_000_000) * OUTPUT_COST_PER_1M
        return input_cost + output_cost
    
    def calculate_cost_cny(self) -> float:
        """Calculate total cost in CNY."""
        return self.calculate_cost_usd() * USD_TO_CNY
    
    def print_report(self):
        """Print detailed cost report."""
        print("\n" + "=" * 70)
        print("AI COST MEASUREMENT REPORT")
        print("=" * 70)
        
        print("\n📊 Token Usage by Operation:")
        for call in self.calls:
            cost_usd = ((call['input_tokens'] / 1_000_000) * INPUT_COST_PER_1M +
                       (call['output_tokens'] / 1_000_000) * OUTPUT_COST_PER_1M)
            cost_cny = cost_usd * USD_TO_CNY
            print(f"   {call['name']:<30} "
                  f"In:{call['input_tokens']:>6,}  Out:{call['output_tokens']:>6,}  "
                  f"¥{cost_cny:>6.4f}  ({call['latency_ms']:>5}ms)")
        
        print(f"\n{'─' * 70}")
        print(f"   {'TOTAL':<30} "
              f"In:{self.total_input_tokens:>6,}  Out:{self.total_output_tokens:>6,}  "
              f"¥{self.calculate_cost_cny():>6.4f}")
        
        input_cost_cny = (self.total_input_tokens / 1_000_000) * INPUT_COST_PER_1M * USD_TO_CNY
        output_cost_cny = (self.total_output_tokens / 1_000_000) * OUTPUT_COST_PER_1M * USD_TO_CNY
        
        print("\n💰 Cost Breakdown:")
        print(f"   Input Tokens:  {self.total_input_tokens:,} × ¥{INPUT_COST_PER_1M * USD_TO_CNY}/M = ¥{input_cost_cny:.4f}")
        print(f"   Output Tokens: {self.total_output_tokens:,} × ¥{OUTPUT_COST_PER_1M * USD_TO_CNY}/M = ¥{output_cost_cny:.4f}")
        print(f"   Total Cost:    ¥{self.calculate_cost_cny():.4f} (${self.calculate_cost_usd():.4f})")


async def simulate_onboarding(client: LLMClient, tracker: CostTracker):
    """Simulate onboarding conversation (5-6 turns)."""
    print("\n[1/5] Simulating Onboarding (5 turns)...")
    
    # Load onboarding prompt
    prompt_file = Path(__file__).parent.parent / "app" / "prompts" / "onboarding.txt"
    prompt_template = prompt_file.read_text(encoding="utf-8")
    
    # Simulate 5 conversation turns
    conversation_history = []
    for turn in range(5):
        # Build context with conversation history
        history_str = "\n".join([
            f"{'user' if i % 2 == 0 else 'assistant'}: {msg}"
            for i, msg in enumerate(conversation_history)
        ])
        
        context = {
            "language": "zh",
            "conversation_history": history_str,
            "user_message": ["", "Python编程", "完全没听过", "完全零基础", "能独立写小程序"][turn],
        }
        
        response = await client.complete(
            prompt_name=f"onboarding_turn_{turn+1}",
            prompt_text=prompt_template,
            variables=context,
            output_format=OutputFormat.JSON,
        )
        
        tracker.add_response(f"onboarding_turn_{turn+1}", response)
        conversation_history.extend([context["user_message"], "assistant response"])
    
    print(f"   ✓ Onboarding: {tracker.calls[-5:][0]['input_tokens'] + tracker.calls[-5:][0]['output_tokens']} tokens (5 turns)")


async def simulate_course_map(client: LLMClient, tracker: CostTracker):
    """Simulate course map (DAG) generation."""
    print("\n[2/5] Simulating Course Map Generation...")
    
    prompt_file = Path(__file__).parent.parent / "app" / "prompts" / "dag.txt"
    prompt_template = prompt_file.read_text(encoding="utf-8")
    
    context = {
        "topic": "Python编程",
        "level": "Beginner",
        "focus": "能独立写小程序",
        "verified_concept": "变量",
        "mode": "Fast",
        "total_commitment_minutes": 120,
        "language": "zh",
    }
    
    response = await client.complete(
        prompt_name="dag",
        prompt_text=prompt_template,
        variables=context,
        output_format=OutputFormat.JSON,
    )
    
    tracker.add_response("course_map_generation", response)
    print(f"   ✓ Course Map: {response.total_tokens:,} tokens")
    
    return response.parsed_data


async def simulate_knowledge_card(client: LLMClient, tracker: CostTracker):
    """Simulate knowledge card generation."""
    print("\n[3/5] Simulating Knowledge Card Generation...")
    
    prompt_file = Path(__file__).parent.parent / "app" / "prompts" / "knowledge_card.txt"
    prompt_template = prompt_file.read_text(encoding="utf-8")
    
    context = {
        "course_name": "Python编程入门",
        "course_context": "从零开始学习Python基础知识",
        "topic": "Python编程",
        "level": "Beginner",
        "mode": "Fast",
        "language": "zh",
        "node_title": "Python基础语法",
        "node_description": "学习变量、数据类型和基本运算",
        "estimated_minutes": 20,
    }
    
    response = await client.complete(
        prompt_name="knowledge_card",
        prompt_text=prompt_template,
        variables=context,
        output_format=OutputFormat.JSON,
    )
    
    tracker.add_response("knowledge_card", response)
    print(f"   ✓ Knowledge Card: {response.total_tokens:,} tokens")
    
    return response.parsed_data


async def simulate_clarification(client: LLMClient, tracker: CostTracker):
    """Simulate clarification (quick Q&A)."""
    print("\n[4/5] Simulating Clarification...")
    
    prompt_file = Path(__file__).parent.parent / "app" / "prompts" / "clarification.txt"
    prompt_template = prompt_file.read_text(encoding="utf-8")
    
    context = {
        "language": "zh",
        "user_question_raw": "什么是变量？",
        "page_markdown": "## Python变量\n\n变量是存储数据的容器。在Python中，你不需要提前声明变量类型。",
    }
    
    response = await client.complete(
        prompt_name="clarification",
        prompt_text=prompt_template,
        variables=context,
        output_format=OutputFormat.JSON,
    )
    
    tracker.add_response("clarification", response)
    print(f"   ✓ Clarification: {response.total_tokens:,} tokens")


async def simulate_qa_detail(client: LLMClient, tracker: CostTracker):
    """Simulate QA detail (deep explanation)."""
    print("\n[4/5] Simulating QA Detail...")
    
    prompt_file = Path(__file__).parent.parent / "app" / "prompts" / "qa_detail.txt"
    prompt_template = prompt_file.read_text(encoding="utf-8")
    
    context = {
        "language": "zh",
        "qa_title": "什么是Python变量？",
        "qa_short_answer": "变量是存储数据值的容器。在Python中使用赋值运算符 = 来创建变量。",
    }
    
    response = await client.complete(
        prompt_name="qa_detail",
        prompt_text=prompt_template,
        variables=context,
        output_format=OutputFormat.JSON,
    )
    
    tracker.add_response("qa_detail", response)
    print(f"   ✓ QA Detail: {response.total_tokens:,} tokens")


async def simulate_quiz(client: LLMClient, tracker: CostTracker):
    """Simulate quiz generation."""
    print("\n[5/5] Simulating Quiz Generation...")
    
    prompt_file = Path(__file__).parent.parent / "app" / "prompts" / "quiz.txt"
    prompt_template = prompt_file.read_text(encoding="utf-8")
    
    context = {
        "language": "zh",
        "mode": "Fast",
        "learned_topics_json": '[{"topic_name":"Python基础","pages_markdown":"## 变量\\n变量用于存储数据..."}]',
    }
    
    response = await client.complete(
        prompt_name="quiz",
        prompt_text=prompt_template,
        variables=context,
        output_format=OutputFormat.JSON,
    )
    
    tracker.add_response("quiz", response)
    print(f"   ✓ Quiz: {response.total_tokens:,} tokens")


async def main():
    """Run cost measurement."""
    print("=" * 70)
    print("EvoBook AI Cost Direct Measurement")
    print("=" * 70)
    print(f"Model: Gemini 1.5 Flash")
    print(f"Input Cost: ${INPUT_COST_PER_1M} per 1M tokens")
    print(f"Output Cost: ${OUTPUT_COST_PER_1M} per 1M tokens")
    print(f"Exchange Rate: 1 USD = {USD_TO_CNY} CNY")
    print("=" * 70)
    
    # Check environment
    required_vars = ["DATABASE_URL", "LITELLM_MODEL", "LITELLM_BASE_URL", "LITELLM_API_KEY"]
    missing = [var for var in required_vars if not os.getenv(var)]
    if missing:
        print(f"\n✗ Missing environment variables: {', '.join(missing)}")
        print("Please set them in your .env file or export them.")
        return 1
    
    # Initialize client
    try:
        settings = Settings()
        client = LLMClient(settings)
        tracker = CostTracker()
        
        print(f"\n✓ Using model: {settings.litellm_model}")
        
        # Run simulations
        await simulate_onboarding(client, tracker)
        await simulate_course_map(client, tracker)
        await simulate_knowledge_card(client, tracker)
        await simulate_clarification(client, tracker)
        await simulate_qa_detail(client, tracker)
        await simulate_quiz(client, tracker)
        
        # Print report
        tracker.print_report()
        
        # Pricing recommendations
        print("\n" + "=" * 70)
        print("PRICING RECOMMENDATIONS")
        print("=" * 70)
        
        total_cost = tracker.calculate_cost_cny()
        
        print(f"\n💡 Single Course Generation Cost: ¥{total_cost:.2f}")
        print(f"   (Including: Onboarding + Course Map + 1 Knowledge Card + QA + Quiz)")
        
        # Estimate for different node counts
        knowledge_card_cost = next(c for c in tracker.calls if c['name'] == 'knowledge_card')
        kc_cost_cny = ((knowledge_card_cost['input_tokens'] / 1_000_000) * INPUT_COST_PER_1M +
                      (knowledge_card_cost['output_tokens'] / 1_000_000) * OUTPUT_COST_PER_1M) * USD_TO_CNY
        
        onboarding_and_dag_cost = total_cost - kc_cost_cny - sum(
            ((c['input_tokens'] / 1_000_000) * INPUT_COST_PER_1M +
             (c['output_tokens'] / 1_000_000) * OUTPUT_COST_PER_1M) * USD_TO_CNY
            for c in tracker.calls if c['name'] in ['clarification', 'qa_detail', 'quiz']
        )
        
        print(f"\n📊 Cost Breakdown by Component:")
        print(f"   Onboarding + Course Map: ¥{onboarding_and_dag_cost:.2f} (one-time per course)")
        print(f"   Knowledge Card (per node): ¥{kc_cost_cny:.2f}")
        print(f"   Clarification (per question): ¥{next((c for c in tracker.calls if c['name']=='clarification'), {}).get('input_tokens', 0) / 1_000_000 * INPUT_COST_PER_1M * USD_TO_CNY + next((c for c in tracker.calls if c['name']=='clarification'), {}).get('output_tokens', 0) / 1_000_000 * OUTPUT_COST_PER_1M * USD_TO_CNY:.4f}")
        print(f"   QA Detail (per question): ¥{next((c for c in tracker.calls if c['name']=='qa_detail'), {}).get('input_tokens', 0) / 1_000_000 * INPUT_COST_PER_1M * USD_TO_CNY + next((c for c in tracker.calls if c['name']=='qa_detail'), {}).get('output_tokens', 0) / 1_000_000 * OUTPUT_COST_PER_1M * USD_TO_CNY:.4f}")
        print(f"   Quiz (per quiz): ¥{next((c for c in tracker.calls if c['name']=='quiz'), {}).get('input_tokens', 0) / 1_000_000 * INPUT_COST_PER_1M * USD_TO_CNY + next((c for c in tracker.calls if c['name']=='quiz'), {}).get('output_tokens', 0) / 1_000_000 * OUTPUT_COST_PER_1M * USD_TO_CNY:.4f}")
        
        print(f"\n📈 Full Course Cost Estimates:")
        for node_count, mode in [(6, "Light"), (12, "Fast"), (18, "Deep")]:
            full_cost = onboarding_and_dag_cost + (kc_cost_cny * node_count)
            print(f"   {mode} mode ({node_count} nodes): ¥{full_cost:.2f}")
        
        print(f"\n💰 Monthly Subscription Cost Estimates:")
        # Use Fast mode (12 nodes) as baseline
        fast_course_cost = onboarding_and_dag_cost + (kc_cost_cny * 12)
        
        tiers = [
            ("Basic (3 courses/month)", 3, 10),
            ("Pro (15 courses/month)", 15, 8),
            ("Enterprise (50 courses/month)", 50, 6),
        ]
        
        for tier_name, course_count, markup in tiers:
            monthly_ai_cost = fast_course_cost * course_count
            suggested_price = monthly_ai_cost * markup
            gross_margin = ((suggested_price - monthly_ai_cost) / suggested_price) * 100
            
            print(f"\n   {tier_name}:")
            print(f"      AI Cost:  ¥{monthly_ai_cost:.2f}")
            print(f"      Suggested Price: ¥{suggested_price:.0f}")
            print(f"      Gross Margin: {gross_margin:.0f}%")
        
        print("\n" + "=" * 70)
        print("✅ Cost Measurement Complete!")
        print("=" * 70)
        
        return 0
        
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))

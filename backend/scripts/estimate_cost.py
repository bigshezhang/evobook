#!/usr/bin/env python3
"""Estimate AI cost based on typical token usage for Gemini 1.5 Flash.

This provides cost estimates based on typical token counts for each operation,
derived from similar AI-powered learning platforms and our prompt complexity.

Gemini 1.5 Flash Pricing (as of 2024):
- Input: $0.075 per 1M tokens
- Output: $0.30 per 1M tokens

Usage:
    python scripts/estimate_cost.py
"""

# Gemini 1.5 Flash Pricing
INPUT_COST_PER_1M = 0.075  # USD
OUTPUT_COST_PER_1M = 0.30  # USD
USD_TO_CNY = 7.2

# Estimated token usage per operation
# Based on prompt complexity analysis and industry benchmarks
OPERATIONS = {
    "onboarding_turn": {
        "count": 5,  # 5 conversation turns
        "input_tokens": 800,  # Prompt + conversation history per turn
        "output_tokens": 150,  # JSON response per turn
    },
    "course_map_dag": {
        "count": 1,
        "input_tokens": 2500,  # Context + requirements + examples
        "output_tokens": 1200,  # DAG JSON with ~12 nodes
    },
    "knowledge_card": {
        "count": 1,  # Per learn node
        "input_tokens": 1800,  # Course context + node details + DSL examples
        "output_tokens": 2500,  # Multi-page markdown + YAML + JSON
    },
    "clarification": {
        "count": 1,  # Per question
        "input_tokens": 900,  # Page context + user question
        "output_tokens": 250,  # Short answer JSON
    },
    "qa_detail": {
        "count": 1,  # Per question
        "input_tokens": 1200,  # QA context + short answer
        "output_tokens": 600,  # Detailed explanation + image prompt
    },
    "quiz": {
        "count": 1,  # Per quiz
        "input_tokens": 1500,  # Learned topics + requirements
        "output_tokens": 1000,  # 5 questions with options JSON
    },
}


def calculate_cost(input_tokens: int, output_tokens: int) -> tuple[float, float]:
    """Calculate cost in USD and CNY."""
    input_cost_usd = (input_tokens / 1_000_000) * INPUT_COST_PER_1M
    output_cost_usd = (output_tokens / 1_000_000) * OUTPUT_COST_PER_1M
    total_usd = input_cost_usd + output_cost_usd
    total_cny = total_usd * USD_TO_CNY
    return total_usd, total_cny


def print_header():
    """Print report header."""
    print("=" * 80)
    print("EvoBook AI Cost Estimation Report (Gemini 1.5 Flash)")
    print("=" * 80)
    print(f"Model: Gemini 1.5 Flash")
    print(f"Input Cost: ${INPUT_COST_PER_1M} per 1M tokens (¥{INPUT_COST_PER_1M * USD_TO_CNY:.3f})")
    print(f"Output Cost: ${OUTPUT_COST_PER_1M} per 1M tokens (¥{OUTPUT_COST_PER_1M * USD_TO_CNY:.2f})")
    print(f"Exchange Rate: 1 USD = {USD_TO_CNY} CNY")
    print("=" * 80)


def print_operation_costs():
    """Print per-operation cost breakdown."""
    print("\n📊 Cost Per Operation:")
    print("─" * 80)
    print(f"{'Operation':<25} {'Input':<10} {'Output':<10} {'Cost (CNY)':<12} {'Cost (USD)'}")
    print("─" * 80)
    
    total_input = 0
    total_output = 0
    
    for name, op in OPERATIONS.items():
        input_tok = op["input_tokens"] * op["count"]
        output_tok = op["output_tokens"] * op["count"]
        cost_usd, cost_cny = calculate_cost(input_tok, output_tok)
        
        display_name = name.replace("_", " ").title()
        print(f"{display_name:<25} {input_tok:>7,}   {output_tok:>7,}   ¥{cost_cny:>9.4f}   ${cost_usd:.4f}")
        
        total_input += input_tok
        total_output += output_tok
    
    total_usd, total_cny = calculate_cost(total_input, total_output)
    print("─" * 80)
    print(f"{'TOTAL (1 of each)':<25} {total_input:>7,}   {total_output:>7,}   ¥{total_cny:>9.4f}   ${total_usd:.4f}")
    print()


def print_course_cost_estimates():
    """Print cost estimates for full course generation."""
    print("\n📈 Full Course Generation Cost Estimates:")
    print("─" * 80)
    
    # One-time costs (onboarding + course map)
    onboarding_input = OPERATIONS["onboarding_turn"]["input_tokens"] * OPERATIONS["onboarding_turn"]["count"]
    onboarding_output = OPERATIONS["onboarding_turn"]["output_tokens"] * OPERATIONS["onboarding_turn"]["count"]
    dag_input = OPERATIONS["course_map_dag"]["input_tokens"]
    dag_output = OPERATIONS["course_map_dag"]["output_tokens"]
    
    onetime_input = onboarding_input + dag_input
    onetime_output = onboarding_output + dag_output
    onetime_usd, onetime_cny = calculate_cost(onetime_input, onetime_output)
    
    # Per-node cost (knowledge card)
    kc_input = OPERATIONS["knowledge_card"]["input_tokens"]
    kc_output = OPERATIONS["knowledge_card"]["output_tokens"]
    kc_usd, kc_cny = calculate_cost(kc_input, kc_output)
    
    # Quiz cost
    quiz_input = OPERATIONS["quiz"]["input_tokens"]
    quiz_output = OPERATIONS["quiz"]["output_tokens"]
    quiz_usd, quiz_cny = calculate_cost(quiz_input, quiz_output)
    
    print(f"One-time costs per course (Onboarding + DAG): ¥{onetime_cny:.2f}")
    print(f"Per learn node (Knowledge Card): ¥{kc_cny:.2f}")
    print(f"Per quiz: ¥{quiz_cny:.2f}")
    print()
    
    # Course modes
    modes = [
        ("Light", 6, 1),
        ("Fast", 12, 2),
        ("Deep", 18, 3),
    ]
    
    print(f"{'Mode':<10} {'Nodes':<8} {'Quizzes':<10} {'Total Cost'}")
    print("─" * 80)
    
    for mode_name, node_count, quiz_count in modes:
        total_cost_usd = onetime_usd + (kc_usd * node_count) + (quiz_usd * quiz_count)
        total_cost_cny = onetime_cny + (kc_cny * node_count) + (quiz_cny * quiz_count)
        print(f"{mode_name:<10} {node_count:<8} {quiz_count:<10} ¥{total_cost_cny:>6.2f} (${total_cost_usd:.4f})")
    
    print()
    return onetime_cny, kc_cny, quiz_cny


def print_qa_cost_estimates():
    """Print cost estimates for QA features."""
    print("\n💬 Interactive QA Cost Estimates:")
    print("─" * 80)
    
    clarif_usd, clarif_cny = calculate_cost(
        OPERATIONS["clarification"]["input_tokens"],
        OPERATIONS["clarification"]["output_tokens"]
    )
    
    qa_detail_usd, qa_detail_cny = calculate_cost(
        OPERATIONS["qa_detail"]["input_tokens"],
        OPERATIONS["qa_detail"]["output_tokens"]
    )
    
    print(f"Clarification (quick answer): ¥{clarif_cny:.4f} per question")
    print(f"QA Detail (deep explanation): ¥{qa_detail_cny:.4f} per question")
    print()


def print_subscription_pricing(onetime_cny, kc_cny, quiz_cny):
    """Print subscription pricing recommendations."""
    print("\n💰 SUBSCRIPTION PRICING RECOMMENDATIONS")
    print("=" * 80)
    
    # Use Fast mode (12 nodes, 2 quizzes) as baseline
    fast_course_cost = onetime_cny + (kc_cny * 12) + (quiz_cny * 2)
    
    # Clarification and QA Detail costs
    clarif_usd, clarif_cny = calculate_cost(
        OPERATIONS["clarification"]["input_tokens"],
        OPERATIONS["clarification"]["output_tokens"]
    )
    qa_detail_usd, qa_detail_cny = calculate_cost(
        OPERATIONS["qa_detail"]["input_tokens"],
        OPERATIONS["qa_detail"]["output_tokens"]
    )
    
    print(f"\nBaseline: Fast mode course = ¥{fast_course_cost:.2f}")
    print(f"Clarification = ¥{clarif_cny:.4f}, QA Detail = ¥{qa_detail_cny:.4f}")
    print()
    
    # Tier configurations
    tiers = [
        {
            "name": "免费体验版",
            "courses": 0,  # 1 course lifetime
            "clarifications": 10,
            "qa_details": 3,
            "suggested_price": 0,
            "description": "1个终身课程 (Light模式)",
        },
        {
            "name": "基础版",
            "courses": 3,
            "clarifications": 30,
            "qa_details": 10,
            "suggested_price": 59,
            "description": "3个课程/月 + 30次快速提问 + 10次深度解答",
        },
        {
            "name": "专业版 (主推)",
            "courses": 15,
            "clarifications": 200,
            "qa_details": 50,
            "suggested_price": 149,
            "description": "15个课程/月 + 200次快速提问 + 50次深度解答",
        },
        {
            "name": "企业旗舰版",
            "courses": 50,
            "clarifications": 999,  # "unlimited" in practice
            "qa_details": 999,
            "suggested_price": 499,
            "description": "50个课程/月 + 无限提问",
        },
    ]
    
    print(f"{'档位':<15} {'月费':<8} {'AI成本':<10} {'毛利率':<10} {'配额描述'}")
    print("=" * 80)
    
    for tier in tiers:
        # Calculate AI cost
        course_cost = fast_course_cost * tier["courses"]
        clarif_cost = clarif_cny * min(tier["clarifications"], 200)  # Cap at reasonable usage
        qa_cost = qa_detail_cny * min(tier["qa_details"], 50)
        total_ai_cost = course_cost + clarif_cost + qa_cost
        
        if tier["suggested_price"] == 0:
            # Free tier - show cost for 1 Light course
            light_cost = onetime_cny + (kc_cny * 6) + (quiz_cny * 1)
            clarif_free = clarif_cny * 10
            qa_free = qa_detail_cny * 3
            total_free_cost = light_cost + clarif_free + qa_free
            print(f"{tier['name']:<15} ¥{tier['suggested_price']:<7} ¥{total_free_cost:>8.2f}   {'N/A':<10} {tier['description']}")
        else:
            gross_margin = ((tier['suggested_price'] - total_ai_cost) / tier['suggested_price']) * 100 if tier['suggested_price'] > 0 else 0
            print(f"{tier['name']:<15} ¥{tier['suggested_price']:<7} ¥{total_ai_cost:>8.2f}   {gross_margin:>6.1f}%    {tier['description']}")
    
    print()


def print_credit_pack_pricing(onetime_cny, kc_cny, quiz_cny):
    """Print credit pack pricing recommendations."""
    print("\n🎫 积分包定价方案 (解决无限制亏损问题)")
    print("=" * 80)
    
    # Fast mode course cost
    fast_course_cost = onetime_cny + (kc_cny * 12) + (quiz_cny * 2)
    
    # QA costs
    clarif_usd, clarif_cny = calculate_cost(
        OPERATIONS["clarification"]["input_tokens"],
        OPERATIONS["clarification"]["output_tokens"]
    )
    qa_detail_usd, qa_detail_cny = calculate_cost(
        OPERATIONS["qa_detail"]["input_tokens"],
        OPERATIONS["qa_detail"]["output_tokens"]
    )
    
    print("\n方案：改\"无限制\"为\"高额度+积分包\"")
    print()
    print("核心机制:")
    print("  1. 所有档位改为固定配额(无\"无限制\")")
    print("  2. 用完配额后,可购买积分包补充")
    print("  3. 积分可用于所有AI功能(课程生成、QA、测验)")
    print()
    
    # Credit conversion
    print("积分兑换比例建议:")
    print(f"  1个课程 (Fast模式) = {int(fast_course_cost * 100)} 积分")
    print(f"  1次Clarification = {int(clarif_cny * 100)} 积分")
    print(f"  1次QA Detail = {int(qa_detail_cny * 100)} 积分")
    print()
    
    # Credit pack options
    packs = [
        {
            "name": "小额积分包",
            "credits": 1000,
            "ai_cost": 10.0,  # ~3 courses worth
            "suggested_price": 68,
            "bonus": "无",
        },
        {
            "name": "标准积分包",
            "credits": 3000,
            "ai_cost": 30.0,  # ~9 courses worth
            "suggested_price": 188,
            "bonus": "+10% (300积分)",
        },
        {
            "name": "超值积分包",
            "credits": 10000,
            "ai_cost": 100.0,  # ~30 courses worth
            "suggested_price": 568,
            "bonus": "+20% (2000积分)",
        },
    ]
    
    print(f"{'积分包':<12} {'积分数':<10} {'AI成本':<10} {'售价':<10} {'毛利率':<10} {'赠送'}")
    print("=" * 80)
    
    for pack in packs:
        gross_margin = ((pack['suggested_price'] - pack['ai_cost']) / pack['suggested_price']) * 100
        print(f"{pack['name']:<12} {pack['credits']:>8,}   ¥{pack['ai_cost']:>8.2f}   ¥{pack['suggested_price']:<9} {gross_margin:>6.1f}%    {pack['bonus']}")
    
    print()
    print("优势:")
    print("  ✓ 避免无限制导致的亏损风险")
    print("  ✓ 高频用户愿意付费购买积分包(额外收入)")
    print("  ✓ 积分包促销可带动用户活跃度")
    print("  ✓ 灵活的变现方式,不强制升级套餐")
    print()


def print_revised_tiers(onetime_cny, kc_cny, quiz_cny):
    """Print revised tier structure without unlimited."""
    print("\n📋 修订后的档位配置(无\"无限制\")")
    print("=" * 80)
    
    fast_course_cost = onetime_cny + (kc_cny * 12) + (quiz_cny * 2)
    
    clarif_usd, clarif_cny = calculate_cost(
        OPERATIONS["clarification"]["input_tokens"],
        OPERATIONS["clarification"]["output_tokens"]
    )
    qa_detail_usd, qa_detail_cny = calculate_cost(
        OPERATIONS["qa_detail"]["input_tokens"],
        OPERATIONS["qa_detail"]["output_tokens"]
    )
    
    revised_tiers = [
        {
            "name": "免费体验版",
            "price": 0,
            "courses": 1,  # lifetime
            "mode": "Light",
            "clarifications": 10,
            "qa_details": 3,
            "community_remix": 0,
            "notes": "终身1个课程,完整体验核心功能",
        },
        {
            "name": "基础版",
            "price": 59,
            "courses": 3,
            "mode": "Light+Fast",
            "clarifications": 30,
            "qa_details": 10,
            "community_remix": 5,
            "notes": "轻度学习者,每月3个课程",
        },
        {
            "name": "专业版 ★",
            "price": 149,
            "courses": 15,
            "mode": "全部",
            "clarifications": 200,
            "qa_details": 50,
            "community_remix": 30,
            "notes": "主推档位,15个课程足够大部分用户",
        },
        {
            "name": "企业旗舰版",
            "price": 499,
            "courses": 100,  # Very high but not "unlimited"
            "mode": "全部+定制",
            "clarifications": 1000,
            "qa_details": 300,
            "community_remix": 200,
            "notes": "高额度+团队协作,超出可购买积分包",
        },
    ]
    
    for tier in revised_tiers:
        print(f"\n【{tier['name']}】 - ¥{tier['price']}/月")
        print(f"  课程生成: {tier['courses']}个/月 ({tier['mode']}模式)")
        print(f"  社区复刻: {tier['community_remix']}个/月")
        print(f"  快速提问(Clarification): {tier['clarifications']}次/月")
        print(f"  深度解答(QA Detail): {tier['qa_details']}次/月")
        print(f"  说明: {tier['notes']}")
        
        # Calculate AI cost
        if tier['price'] > 0:
            course_cost = fast_course_cost * tier['courses']
            clarif_cost = clarif_cny * tier['clarifications']
            qa_cost = qa_detail_cny * tier['qa_details']
            total_cost = course_cost + clarif_cost + qa_cost
            margin = ((tier['price'] - total_cost) / tier['price']) * 100
            print(f"  AI成本: ¥{total_cost:.2f}, 毛利率: {margin:.1f}%")
    
    print()


def main():
    """Generate cost estimation report."""
    print_header()
    print_operation_costs()
    onetime_cny, kc_cny, quiz_cny = print_course_cost_estimates()
    print_qa_cost_estimates()
    print_subscription_pricing(onetime_cny, kc_cny, quiz_cny)
    print_credit_pack_pricing(onetime_cny, kc_cny, quiz_cny)
    print_revised_tiers(onetime_cny, kc_cny, quiz_cny)
    
    print("\n" + "=" * 80)
    print("✅ 成本估算完成!")
    print()
    print("关键建议:")
    print("  1. 移除所有\"无限制\"档位,改为高额度+积分包补充")
    print("  2. 专业版(¥149)设为主推,配额设计引导大部分用户选择此档")
    print("  3. 企业版(¥499)设为锚点+高端用户,100个课程配额基本够用")
    print("  4. 积分包作为额外变现手段,满足超额需求")
    print("=" * 80)
    print()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""管理员充值工具 — 支持给用户充值金币、经验、骰子，或查看用户信息。

用法:
    uv run python3 scripts/admin_topup.py info   <email_or_uuid>
    uv run python3 scripts/admin_topup.py gold   <email_or_uuid> <amount>
    uv run python3 scripts/admin_topup.py exp    <email_or_uuid> <amount>
    uv run python3 scripts/admin_topup.py dice   <email_or_uuid> <amount>

示例:
    uv run python3 scripts/admin_topup.py info  233@test.com
    uv run python3 scripts/admin_topup.py gold  233@test.com 5000
    uv run python3 scripts/admin_topup.py exp   233@test.com 999
    uv run python3 scripts/admin_topup.py dice  233@test.com 1000
"""

import asyncio
import sys
from pathlib import Path
from uuid import UUID as _UUID

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.config import get_settings

# ── 资源类型 → 数据库字段 / 显示名 映射 ──────────────────
RESOURCE_MAP: dict[str, dict[str, str]] = {
    "gold": {"column": "gold_balance", "label": "金币", "icon": "💰"},
    "exp":  {"column": "current_exp",  "label": "经验", "icon": "⭐"},
    "dice": {"column": "dice_rolls_count", "label": "骰子", "icon": "🎲"},
}


def _is_uuid(value: str) -> bool:
    try:
        _UUID(value)
        return True
    except ValueError:
        return False


async def _get_engine_and_session():
    """Create engine + session factory."""
    settings = get_settings()
    engine = create_async_engine(settings.database_url, echo=False)
    factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return engine, factory


async def _find_profile(session: AsyncSession, identifier: str):
    """通过 email 或 UUID 查找用户 profile 行。"""
    if _is_uuid(identifier):
        q = text("""
            SELECT id, email, display_name, gold_balance, current_exp, dice_rolls_count, level
            FROM profiles WHERE id = :val
        """)
    else:
        q = text("""
            SELECT id, email, display_name, gold_balance, current_exp, dice_rolls_count, level
            FROM profiles WHERE email = :val
        """)
    result = await session.execute(q, {"val": identifier})
    return result.fetchone()


async def _list_users(session: AsyncSession) -> None:
    """打印最近的用户列表。"""
    q = text("""
        SELECT id, email, display_name, gold_balance, current_exp, dice_rolls_count, level
        FROM profiles ORDER BY created_at DESC LIMIT 10
    """)
    result = await session.execute(q)
    users = result.fetchall()
    print("💡 可用用户列表:")
    for u in users:
        uid, mail, name, gold, exp, dice, lvl = u
        name_str = name or "(未设置)"
        mail_str = mail or "(无邮箱)"
        print(f"   {mail_str}  |  {name_str}  |  Lv.{lvl}  |  💰{gold}  ⭐{exp}  🎲{dice}  |  {uid}")


# ── info 命令 ─────────────────────────────────────────────

async def cmd_info(identifier: str) -> bool:
    """查看用户详细信息。"""
    engine, factory = await _get_engine_and_session()
    async with factory() as session:
        row = await _find_profile(session, identifier)
        if not row:
            print(f"❌ 用户不存在: {identifier}")
            await _list_users(session)
            return False

        uid, mail, name, gold, exp, dice, lvl = row
        print(f"┌─────────────────────────────────────────")
        print(f"│  用户信息")
        print(f"├─────────────────────────────────────────")
        print(f"│  ID:    {uid}")
        print(f"│  邮箱:  {mail or '(无)'}")
        print(f"│  名称:  {name or '(未设置)'}")
        print(f"│  等级:  Lv.{lvl}")
        print(f"├─────────────────────────────────────────")
        print(f"│  💰 金币:  {gold}")
        print(f"│  ⭐ 经验:  {exp}")
        print(f"│  🎲 骰子:  {dice}")
        print(f"└─────────────────────────────────────────")
        return True
    await engine.dispose()


# ── topup 命令 ────────────────────────────────────────────

async def cmd_topup(resource: str, identifier: str, amount: int) -> bool:
    """给用户充值指定资源。"""
    meta = RESOURCE_MAP[resource]
    column = meta["column"]
    label = meta["label"]
    icon = meta["icon"]

    engine, factory = await _get_engine_and_session()
    async with factory() as session:
        row = await _find_profile(session, identifier)
        if not row:
            print(f"❌ 用户不存在: {identifier}")
            await _list_users(session)
            return False

        uid, mail, name, gold, exp, dice, lvl = row
        name_str = name or "(未设置)"
        mail_str = mail or "(无邮箱)"

        # 获取当前值
        current_values = {"gold_balance": gold, "current_exp": exp, "dice_rolls_count": dice}
        current = current_values[column]
        new_value = current + amount

        print(f"✅ 找到用户: {mail_str} / {name_str}")
        print(f"   {icon} 当前{label}: {current}")

        # 执行更新
        update_q = text(f"""
            UPDATE profiles
            SET {column} = :new_value, updated_at = NOW()
            WHERE id = :user_id
        """)
        await session.execute(update_q, {"new_value": new_value, "user_id": uid})
        await session.commit()

        print(f"   {icon} 充值{label}: +{amount}")
        print(f"   {icon} 充值后{label}: {new_value}")
        return True
    await engine.dispose()


# ── main ──────────────────────────────────────────────────

USAGE = """用法:
    uv run python3 scripts/admin_topup.py info   <email_or_uuid>
    uv run python3 scripts/admin_topup.py gold   <email_or_uuid> <amount>
    uv run python3 scripts/admin_topup.py exp    <email_or_uuid> <amount>
    uv run python3 scripts/admin_topup.py dice   <email_or_uuid> <amount>

示例:
    uv run python3 scripts/admin_topup.py info  233@test.com
    uv run python3 scripts/admin_topup.py gold  233@test.com 5000
    uv run python3 scripts/admin_topup.py dice  233@test.com 1000"""


async def main() -> None:
    if len(sys.argv) < 3:
        print(USAGE)
        sys.exit(1)

    command = sys.argv[1].lower()
    identifier = sys.argv[2]

    # ── info 命令 ──
    if command == "info":
        print(f"🔍 查询用户: {identifier}")
        print("=" * 50)
        success = await cmd_info(identifier)
        sys.exit(0 if success else 1)

    # ── 充值命令 ──
    if command not in RESOURCE_MAP:
        print(f"❌ 未知命令: {command}")
        print(f"   支持的命令: info, {', '.join(RESOURCE_MAP.keys())}")
        print()
        print(USAGE)
        sys.exit(1)

    if len(sys.argv) < 4:
        print(f"❌ 缺少充值数量参数")
        print(USAGE)
        sys.exit(1)

    try:
        amount = int(sys.argv[3])
    except ValueError:
        print("❌ 充值数量必须是整数")
        sys.exit(1)

    if amount <= 0:
        print("❌ 充值数量必须大于 0")
        sys.exit(1)

    meta = RESOURCE_MAP[command]
    print(f"{meta['icon']} 准备给 {identifier} 充值 {amount} {meta['label']}...")
    print("=" * 50)

    success = await cmd_topup(command, identifier, amount)

    print("=" * 50)
    if success:
        print("🎉 操作完成!")
    else:
        print("❌ 操作失败")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())

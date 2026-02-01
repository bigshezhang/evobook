"""LLM client with retry logic and output validation."""

import asyncio
import hashlib
import time
from dataclasses import dataclass
from typing import Any
from uuid import uuid4

import litellm

from app.config import Settings, get_settings
from app.core.exceptions import LLMError, LLMValidationError
from app.core.logging import get_logger
from app.llm.validators import OutputFormat, validate_json, validate_markdown, validate_yaml

logger = get_logger(__name__)


@dataclass
class LLMResponse:
    """Response from LLM completion."""
    
    request_id: str
    prompt_name: str
    prompt_hash: str
    raw_text: str
    parsed_data: dict | str | None
    success: bool
    retries: int
    latency_ms: int
    model: str


class LLMClient:
    """Client for LLM completions with retry and validation."""
    
    def __init__(self, settings: Settings | None = None) -> None:
        """Initialize LLM client.
        
        Args:
            settings: Application settings. Uses get_settings() if None.
        """
        self._settings = settings or get_settings()
    
    async def complete(
        self,
        prompt_name: str,
        prompt_text: str,
        variables: dict[str, Any] | None = None,
        output_format: OutputFormat = OutputFormat.TEXT,
        system_message: str | None = None,
    ) -> LLMResponse:
        """Call LLM and return validated result.
        
        Args:
            prompt_name: Name of the prompt (for logging/tracing).
            prompt_text: The prompt template text.
            variables: Variables to substitute in prompt_text (using .format()).
            output_format: Expected output format for validation.
            system_message: Optional system message.
            
        Returns:
            LLMResponse with parsed data.
            
        Raises:
            LLMValidationError: If output validation fails after retries.
            LLMError: If LLM call fails after retries.
        """
        request_id = str(uuid4())
        prompt_hash = self._calculate_prompt_hash(prompt_text)
        
        # Substitute variables if provided
        if variables:
            prompt_text = prompt_text.format(**variables)
        
        start_time = time.monotonic()
        retries = 0
        last_error: Exception | None = None
        raw_text = ""
        
        # Try up to max_retries + 1 times (initial + retries)
        max_attempts = self._settings.llm_max_retries + 1
        
        for attempt in range(max_attempts):
            try:
                if self._settings.mock_llm:
                    # Extract session_id from prompt_text for onboarding
                    session_id = self._extract_session_id_from_prompt(prompt_text)
                    raw_text = self._get_mock_response(prompt_name, output_format, session_id)
                else:
                    raw_text = await self._call_llm(prompt_text, system_message)
                
                # Validate output
                parsed_data = self._validate_output(raw_text, output_format)
                
                latency_ms = int((time.monotonic() - start_time) * 1000)
                
                response = LLMResponse(
                    request_id=request_id,
                    prompt_name=prompt_name,
                    prompt_hash=prompt_hash,
                    raw_text=raw_text,
                    parsed_data=parsed_data,
                    success=True,
                    retries=retries,
                    latency_ms=latency_ms,
                    model=self._settings.litellm_model,
                )
                
                self._log_completion(response)
                return response
                
            except LLMValidationError as e:
                last_error = e
                retries = attempt + 1
                if attempt < max_attempts - 1:
                    delay = 2 ** attempt  # Exponential backoff: 1s, 2s, 4s...
                    logger.warning(
                        "LLM validation failed, retrying",
                        request_id=request_id,
                        prompt_name=prompt_name,
                        attempt=attempt + 1,
                        delay_seconds=delay,
                        error=str(e),
                    )
                    await asyncio.sleep(delay)
                    
            except Exception as e:
                last_error = e
                retries = attempt + 1
                if attempt < max_attempts - 1:
                    delay = 2 ** attempt
                    logger.warning(
                        "LLM call failed, retrying",
                        request_id=request_id,
                        prompt_name=prompt_name,
                        attempt=attempt + 1,
                        delay_seconds=delay,
                        error=str(e),
                    )
                    await asyncio.sleep(delay)
        
        # All retries exhausted
        latency_ms = int((time.monotonic() - start_time) * 1000)
        
        response = LLMResponse(
            request_id=request_id,
            prompt_name=prompt_name,
            prompt_hash=prompt_hash,
            raw_text=raw_text,
            parsed_data=None,
            success=False,
            retries=retries,
            latency_ms=latency_ms,
            model=self._settings.litellm_model,
        )
        
        self._log_completion(response)
        
        if isinstance(last_error, LLMValidationError):
            raise last_error
        raise LLMError(
            message=f"LLM call failed after {retries} retries: {last_error}",
            details={"request_id": request_id, "prompt_name": prompt_name},
        )
    
    def _calculate_prompt_hash(self, text: str) -> str:
        """Calculate SHA256 hash of prompt text.
        
        Args:
            text: Prompt text to hash.
            
        Returns:
            Hex-encoded SHA256 hash.
        """
        return hashlib.sha256(text.encode("utf-8")).hexdigest()
    
    def _extract_session_id_from_prompt(self, prompt_text: str) -> str | None:
        """Extract conversation turn count from prompt text for mock responses.
        
        The onboarding prompt includes context with conversation history.
        This method counts user turns to determine which phase of mock response to return.
        
        Args:
            prompt_text: The full prompt text with context.
            
        Returns:
            String representation of turn count, or None for first turn.
        """
        import re
        
        # Look for conversation history entries which indicate an existing session
        # The history format includes "user:" and "assistant:" entries
        user_turns = len(re.findall(r'\buser:', prompt_text, re.IGNORECASE))
        
        # Return the turn count as a string, this will be used as mock phase index
        if user_turns > 0:
            return str(user_turns)
        
        return None
    
    async def _call_llm(self, prompt_text: str, system_message: str | None) -> str:
        """Make actual LLM API call.
        
        Args:
            prompt_text: User prompt text.
            system_message: Optional system message.
            
        Returns:
            Raw response text.
            
        Raises:
            LLMError: If API call fails.
        """
        messages = []
        if system_message:
            messages.append({"role": "system", "content": system_message})
        messages.append({"role": "user", "content": prompt_text})
        
        try:
            response = await litellm.acompletion(
                model=self._settings.litellm_model,
                messages=messages,
                api_base=self._settings.litellm_base_url,
                api_key=self._settings.litellm_api_key,
                timeout=self._settings.llm_timeout,
            )
            
            content = response.choices[0].message.content
            if content is None:
                raise LLMError(
                    message="LLM returned empty content",
                    details=None,
                )
            return content
            
        except litellm.exceptions.Timeout as e:
            raise LLMError(
                message=f"LLM request timed out after {self._settings.llm_timeout}s",
                details={"timeout": self._settings.llm_timeout},
            ) from e
        except Exception as e:
            if isinstance(e, LLMError):
                raise
            raise LLMError(
                message=f"LLM API call failed: {e}",
                details=None,
            ) from e
    
    def _get_mock_response(self, prompt_name: str, output_format: OutputFormat, session_id: str | None = None) -> str:
        """Generate mock response for testing.
        
        Args:
            prompt_name: Name of the prompt.
            output_format: Expected output format.
            session_id: Optional session ID for stateful mock responses.
            
        Returns:
            Mock response text.
        """
        # Handle onboarding with phase-aware mock responses
        if prompt_name == "onboarding":
            return self._get_onboarding_mock_response(session_id)
        
        # Handle DAG generation with valid structure
        if prompt_name == "dag":
            return self._get_dag_mock_response()
        
        # Handle knowledge card generation
        if prompt_name == "knowledge_card":
            return self._get_knowledge_card_mock_response()
        
        # Handle clarification generation
        if prompt_name == "clarification":
            return self._get_clarification_mock_response()
        
        # Handle QA detail generation
        if prompt_name == "qa_detail":
            return self._get_qa_detail_mock_response()
        
        # Handle quiz generation
        if prompt_name == "quiz":
            return self._get_quiz_mock_response()
        
        if output_format == OutputFormat.JSON:
            return f'{{"mock": true, "type": "{prompt_name}"}}'
        elif output_format == OutputFormat.YAML:
            return f"mock: true\ntype: {prompt_name}"
        elif output_format == OutputFormat.MARKDOWN:
            return f"# Mock Response\n\nThis is a mock response for {prompt_name}."
        else:
            return f"Mock response for {prompt_name}"
    
    def _get_onboarding_mock_response(self, turn_count_str: str | None = None) -> str:
        """Generate mock response for onboarding based on conversation turn count.
        
        This uses the turn count from the conversation history to determine
        which phase of onboarding to return.
        
        Args:
            turn_count_str: String representation of user turn count from prompt.
        
        Returns:
            JSON string with mock onboarding response.
        """
        import json
        
        # Parse turn count - if None or empty, this is the first call (turn 0)
        if turn_count_str is None or turn_count_str == "":
            counter = 0
        else:
            try:
                counter = int(turn_count_str)
            except ValueError:
                counter = 0
        
        # Phase 1: Exploration (first call)
        if counter == 0:
            return json.dumps({
                "type": "chat",
                "message": "你好！我是你的学习向导。你想学习什么呢？",
                "options": ["Python 编程", "机器学习", "Web 开发"]
            })
        
        # Phase 2: Calibration R1 (second call)
        elif counter == 1:
            return json.dumps({
                "type": "chat",
                "message": "太棒了！让我了解一下你的基础。你对「装饰器」这个概念熟悉吗？",
                "options": ["完全没听过", "听说过，大概知道原理", "熟练掌握"]
            })
        
        # Phase 3: Calibration R2 (third call)
        elif counter == 2:
            return json.dumps({
                "type": "chat",
                "message": "明白了！那你之前有接触过编程吗？",
                "options": ["完全零基础", "看过一些入门文章", "以前学过一点"]
            })
        
        # Phase 4: Focus (fourth call)
        elif counter == 3:
            return json.dumps({
                "type": "chat",
                "message": "了解了！如果给你 2-4 周，你最想达成什么目标？",
                "options": ["能独立写小程序", "理解核心概念", "做出实际项目"]
            })
        
        # Phase 5: Source (fifth call)
        elif counter == 4:
            return json.dumps({
                "type": "chat",
                "message": "最后一个问题：你是从哪里了解到我们的？",
                "options": ["朋友推荐", "社交媒体", "搜索引擎"]
            })
        
        # Phase 6: Handoff (sixth call and beyond)
        else:
            return json.dumps({
                "type": "finish",
                "message": "太好了！你的学习档案已经准备好了。",
                "options": [],
                "data": {
                    "topic": "Python 编程",
                    "level": "Beginner",
                    "verified_concept": "装饰器",
                    "focus": "能独立写小程序",
                    "source": "朋友推荐",
                    "intent": "add_info"
                }
            })
    
    @classmethod
    def reset_mock_counter(cls) -> None:
        """Reset mock state for testing.
        
        This is now a no-op since mock responses are based on conversation
        turn count extracted from the prompt, not a global counter.
        Kept for backward compatibility with existing tests.
        """
        pass
    
    # Class-level variable to configure mock DAG response
    _mock_dag_total_minutes: int = 120
    _mock_dag_mode: str = "Fast"
    
    @classmethod
    def set_mock_dag_context(cls, total_minutes: int, mode: str) -> None:
        """Set context for mock DAG generation.
        
        Args:
            total_minutes: Total commitment minutes for the mock DAG.
            mode: Learning mode (Deep|Fast|Light).
        """
        cls._mock_dag_total_minutes = total_minutes
        cls._mock_dag_mode = mode
    
    def _get_dag_mock_response(self) -> str:
        """Generate mock DAG response for testing.
        
        Returns a valid DAG structure with:
        - Proper branch structure (layer 2 with 2 parallel nodes)
        - A merge node (node with 2+ prerequisites)
        - Time sum equal to _mock_dag_total_minutes
        - No boss nodes if mode != Deep
        
        Returns:
            JSON string with mock DAG response.
        """
        import json
        
        total_minutes = LLMClient._mock_dag_total_minutes
        mode = LLMClient._mock_dag_mode
        
        # Distribute time across nodes (5 nodes for Fast/Light, 7 for Deep)
        if mode == "Deep":
            # Deep mode: 7 nodes with boss
            # Use percentage-based allocation to ensure exact sum
            # Layer 1: 15% (root)
            # Layer 2: 15% + 15% (branch)
            # Layer 3: 12% + 12% (branch)
            # Layer 4: 16% (merge)
            # Layer 5: 15% (boss)
            # Total: 100%
            t1 = total_minutes * 15 // 100  # root
            t2 = total_minutes * 15 // 100  # branch A
            t3 = total_minutes * 15 // 100  # branch B
            t4 = total_minutes * 12 // 100  # advanced A
            t5 = total_minutes * 12 // 100  # advanced B
            t6 = total_minutes * 16 // 100  # merge
            # Adjust last node to ensure exact sum
            t7 = total_minutes - t1 - t2 - t3 - t4 - t5 - t6
            
            nodes = [
                {"id": 1, "title": "基础入门", "description": "掌握核心概念基础", "type": "learn", "layer": 1, "pre_requisites": [], "estimated_minutes": t1},
                {"id": 2, "title": "分支路径 A", "description": "深入学习路径 A", "type": "learn", "layer": 2, "pre_requisites": [1], "estimated_minutes": t2},
                {"id": 3, "title": "分支路径 B", "description": "深入学习路径 B", "type": "learn", "layer": 2, "pre_requisites": [1], "estimated_minutes": t3},
                {"id": 4, "title": "进阶路径 A", "description": "进阶学习 A", "type": "learn", "layer": 3, "pre_requisites": [2], "estimated_minutes": t4},
                {"id": 5, "title": "进阶路径 B", "description": "进阶学习 B", "type": "learn", "layer": 3, "pre_requisites": [3], "estimated_minutes": t5},
                {"id": 6, "title": "知识汇合", "description": "整合所有知识点", "type": "quiz", "layer": 4, "pre_requisites": [4, 5], "estimated_minutes": t6},
                {"id": 7, "title": "终极挑战", "description": "综合能力检验", "type": "boss", "layer": 5, "pre_requisites": [6], "estimated_minutes": t7},
            ]
        else:
            # Fast/Light mode: 5 nodes without boss
            # Layer 1: 1 node (root) - 20% 
            # Layer 2: 2 nodes (branch) - 25% each
            # Layer 3: 1 node (merge) - 15%
            # Layer 4: 1 node (final) - 15%
            # Total: 20 + 50 + 15 + 15 = 100%
            t1 = total_minutes * 20 // 100
            t2 = total_minutes * 25 // 100
            t3 = total_minutes * 15 // 100
            # Adjust last node to ensure exact sum
            t4 = total_minutes - t1 - t2 - t2 - t3
            
            nodes = [
                {"id": 1, "title": "基础入门", "description": "掌握核心概念基础", "type": "learn", "layer": 1, "pre_requisites": [], "estimated_minutes": t1},
                {"id": 2, "title": "分支路径 A", "description": "深入学习路径 A", "type": "learn", "layer": 2, "pre_requisites": [1], "estimated_minutes": t2},
                {"id": 3, "title": "分支路径 B", "description": "深入学习路径 B", "type": "learn", "layer": 2, "pre_requisites": [1], "estimated_minutes": t2},
                {"id": 4, "title": "知识汇合", "description": "整合所有知识点", "type": "quiz", "layer": 3, "pre_requisites": [2, 3], "estimated_minutes": t3},
                {"id": 5, "title": "实战演练", "description": "应用所学知识", "type": "learn", "layer": 4, "pre_requisites": [4], "estimated_minutes": t4},
            ]
        
        time_sum = sum(n["estimated_minutes"] for n in nodes)
        
        return json.dumps({
            "map_meta": {
                "course_name": "Python 编程入门之旅",
                "strategy_rationale": "基于用户的基础水平，设计了渐进式学习路径，通过分支探索和知识汇合确保全面掌握",
                "mode": mode,
                "time_budget_minutes": total_minutes,
                "time_sum_minutes": time_sum,
                "time_delta_minutes": 0,
            },
            "nodes": nodes,
        }, ensure_ascii=False)
    
    def _get_knowledge_card_mock_response(self) -> str:
        """Generate mock knowledge card response for testing.
        
        Returns:
            JSON string with mock knowledge card response.
        """
        import json
        
        markdown = """## Introduction to Python Variables

Variables are containers for storing data values. In Python, you don't need to declare a variable before using it.

<EVOBK_KEY_ELEMENTS title="Key Structural Elements">
  <EVOBK_KEY title="Variable Assignment">Use = to assign values to variables</EVOBK_KEY>
  <EVOBK_KEY title="Dynamic Typing">Python determines the type automatically</EVOBK_KEY>
  <EVOBK_KEY title="Naming Rules">Must start with letter or underscore</EVOBK_KEY>
</EVOBK_KEY_ELEMENTS>

<EVOBK_EXPERT_TIP title="Expert Tip">
Use descriptive variable names that explain what the variable holds. This makes your code self-documenting and easier to maintain.
</EVOBK_EXPERT_TIP>

<EVOBK_PAGE_BREAK />

## Working with Data Types

Python has several built-in data types for different kinds of values.

| Type | Example | Description |
|------|---------|-------------|
| int | 42 | Whole numbers |
| float | 3.14 | Decimal numbers |
| str | "hello" | Text strings |

You can check a variable's type using the `type()` function."""

        return json.dumps({
            "type": "knowledge_card",
            "node_id": 1,
            "totalPagesInCard": 2,
            "markdown": markdown,
            "yaml": "type: knowledge_card\nnode_id: 1\ntotalPagesInCard: 2",
        }, ensure_ascii=False)
    
    def _get_clarification_mock_response(self) -> str:
        """Generate mock clarification response for testing.
        
        Returns:
            JSON string with mock clarification response.
        """
        import json
        
        return json.dumps({
            "type": "clarification",
            "corrected_title": "What is variable assignment in Python?",
            "short_answer": "Variable assignment in Python uses the = operator. "
                           "Unlike some languages, you don't need to declare the type first. "
                           "Just write: my_variable = value. Python will automatically "
                           "determine the type based on the value you assign.",
        }, ensure_ascii=False)
    
    def _get_qa_detail_mock_response(self) -> str:
        """Generate mock QA detail response for testing.
        
        Returns:
            JSON string with mock QA detail response.
        """
        import json
        
        return json.dumps({
            "type": "qa_detail",
            "title": "Understanding Variable Assignment in Python",
            "body_markdown": """Variable assignment is the process of storing a value in a variable.

**How it works:**
- The variable name goes on the left side of the = sign
- The value to store goes on the right side
- Python evaluates the right side first, then stores the result

**Examples:**
- `x = 5` stores the integer 5
- `name = "Alice"` stores a string
- `total = x + 10` stores the result of the calculation

**Key point:** Variables in Python are actually references to objects in memory, not the objects themselves.""",
            "image": {
                "placeholder": "[[IMAGE:variable-assignment-diagram]]",
                "prompt": "Educational diagram showing Python variable assignment process: "
                         "left side shows a box labeled 'x', an arrow pointing from '=' sign, "
                         "and right side shows the value '5'. Include labels for 'variable name', "
                         "'assignment operator', and 'value'. Use clean, minimal style with "
                         "blue and white colors.",
            },
        }, ensure_ascii=False)
    
    def _get_quiz_mock_response(self) -> str:
        """Generate mock quiz response for testing.
        
        Returns:
            JSON string with mock quiz response.
        """
        import json
        
        return json.dumps({
            "type": "quiz",
            "title": "Python Variables Quiz",
            "greeting": {
                "topics_included": ["Variables", "Data Types"],
                "message": "Let's test your understanding of Python variables and data types!",
            },
            "questions": [
                {
                    "qtype": "single",
                    "prompt": "Which operator is used for variable assignment in Python?",
                    "options": ["==", "=", ":=", "->"],
                    "answer": "=",
                },
                {
                    "qtype": "boolean",
                    "prompt": "In Python, you must declare a variable's type before using it.",
                    "answer": "False",
                },
                {
                    "qtype": "multi",
                    "prompt": "Which of the following are valid Python variable names?",
                    "options": ["my_var", "2nd_var", "_private", "class"],
                    "answers": ["my_var", "_private"],
                },
                {
                    "qtype": "single",
                    "prompt": "What is the result of type(3.14)?",
                    "options": ["<class 'int'>", "<class 'float'>", "<class 'str'>", "<class 'number'>"],
                    "answer": "<class 'float'>",
                },
                {
                    "qtype": "boolean",
                    "prompt": "Python variables are dynamically typed.",
                    "answer": "True",
                },
            ],
        }, ensure_ascii=False)
    
    def _validate_output(
        self, text: str, output_format: OutputFormat
    ) -> dict | str | None:
        """Validate and parse output based on format.
        
        Args:
            text: Raw response text.
            output_format: Expected format.
            
        Returns:
            Parsed data (dict for JSON/YAML, str for markdown/text).
            
        Raises:
            LLMValidationError: If validation fails.
        """
        if output_format == OutputFormat.JSON:
            return validate_json(text)
        elif output_format == OutputFormat.YAML:
            return validate_yaml(text)
        elif output_format == OutputFormat.MARKDOWN:
            return validate_markdown(text)
        else:
            return text
    
    def _log_completion(self, response: LLMResponse) -> None:
        """Log LLM completion details.
        
        Args:
            response: The LLM response to log.
        """
        log_method = logger.info if response.success else logger.error
        log_method(
            "LLM completion",
            request_id=response.request_id,
            prompt_name=response.prompt_name,
            prompt_hash=response.prompt_hash[:16] + "...",  # Truncate for readability
            model=response.model,
            retries=response.retries,
            latency_ms=response.latency_ms,
            success=response.success,
        )

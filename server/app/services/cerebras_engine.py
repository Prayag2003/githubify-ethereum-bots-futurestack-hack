# server/app/services/cerebras_engine.py
import os
from dotenv import load_dotenv
from cerebras.cloud.sdk import AsyncCerebras

class CerebrasLLMClientAsync:
    """
    Async wrapper for Cerebras LLM inference.
    OpenAI-compatible style interface.
    """

    def __init__(self, default_model: str = "llama3.1-70b", default_system_prompt: str | None = None):
        load_dotenv()
        api_key = os.environ.get("CEREBRAS_API_KEY")
        if not api_key:
            raise ValueError("CEREBRAS_API_KEY environment variable is required")

        self.client = AsyncCerebras(api_key=api_key)
        self.default_model = default_model
        self.default_system_prompt = default_system_prompt

    async def chat(self, messages: list[dict], model: str | None = None, system_prompt: str | None = None) -> dict:
        """
        Run a chat-style completion asynchronously.
        messages: List of dicts [{"role": "user", "content": "..."}]
        model: override default model
        system_prompt: override default system prompt
        Returns: dict with model output
        """
        full_messages = []

        # Pick system prompt (runtime > default)
        sp = system_prompt or self.default_system_prompt
        if sp:
            full_messages.append({"role": "system", "content": sp})

        full_messages.extend(messages)

        response = await self.client.chat.completions.create(
            messages=full_messages,
            model=model or self.default_model,
        )

        return {"text": response.choices[0].message.content}

    async def completion(self, prompt: str, model: str | None = None, system_prompt: str | None = None) -> dict:
        """
        Simple single-turn completion using chat interface asynchronously.
        """
        messages = [{"role": "user", "content": prompt}]
        return await self.chat(messages, model=model, system_prompt=system_prompt)

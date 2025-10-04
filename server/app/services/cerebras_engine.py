import os
from dotenv import load_dotenv
from cerebras.cloud.sdk import AsyncCerebras

class CerebrasLLMClientAsync:
    """
    Async wrapper for Cerebras LLM inference.
    OpenAI-compatible style interface.
    """

    def __init__(self, default_model: str = "llama3.1-8b", default_system_prompt: str | None = None):
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

    async def stream_completion(
        self,
        prompt: str,
        model: str | None = None,
        system_prompt: str | None = None,
        socket_id: str | None = None,
        sio=None
    ):
        """
        Stream a completion using Cerebras and optionally send via Socket.IO.
        """
        print("SIO: ", sio)
        messages = [{"role": "user", "content": prompt}]
        if system_prompt:
            messages.insert(0, {"role": "system", "content": system_prompt})

        # Create async generator with stream=True
        stream = await self.client.chat.completions.create(
            messages=messages,
            model=model or self.default_model,
            stream=True  # streaming mode
        )

        full_text = ""
        async for chunk in stream:  # async iteration
            delta = chunk.choices[0].delta.content or ""
            full_text += delta

            # If Socket.IO is provided, emit incrementally
            if socket_id and sio:
                await sio.emit("query_chunk", {"text": delta}, to=socket_id)

        # Send final completion event
        if socket_id and sio:
            await sio.emit("query_complete", {"text": full_text}, to=socket_id)

        return full_text

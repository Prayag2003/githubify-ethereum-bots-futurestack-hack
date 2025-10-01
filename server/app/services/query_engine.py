from .cerebras_engine import CerebrasLLMClientAsync

# Default: fast inference model
llm = CerebrasLLMClientAsync(default_model="llama-3.1-8b")

async def handle_query(repo_id: str, query: str, mode: str = "fast") -> str:
    """
    Handle a user query against the repo.
    mode: "fast" (llama-3.1-8b) or "accurate" (larger model like qwen3-480b-coder)
    """
    # TODO: fetch relevant repo snippets here
    # snippets = get_snippets_from_repo(repo_id, query)

    # Map modes to models
    model_map = {
        "fast": "llama-3.1-8b",
        "accurate": "qwen3-480b-coder",
    }
    chosen_model = model_map.get(mode, "llama-3.1-8b")

    system_prompt = (
        "You are an expert codebase comprehension assistant. "
        "Analyze the repository code and provide helpful, concise answers."
    )

    prompt = f"User query: {query}\nAnswer:"

    response = await llm.completion(
        prompt,
        model=chosen_model,
        system_prompt=system_prompt,
    )

    print("Response from Cerebras", response)
    return response["text"]

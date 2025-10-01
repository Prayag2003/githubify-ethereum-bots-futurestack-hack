# Githubify-v1

A tool to analyze GitHub repositories.

## 🛠 Install UV

## Setup Instructions

1. Clone the repository:

```bash
git clone https://github.com/Prayag2003/githubify-ethereum-bots-futurestack-hack
cd githubify-ethereum-bots-futurestack-hack
```

2. Navigate to project directory:

```bash
cd server
```

3. Install dependencies using UV:

```bash
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt
```

4. Build the grammar parser

```bash
cd app/
bash automate.sh
python parser/lang_build.py
```

5. Start the development server:

```bash
uvicorn app.main:app --reload
```

## API Usage

To analyze a GitHub repository, send a POST request to `/repos/ingest` endpoint:
![Clone Repo](assets/clone.png)

```bash
curl -X POST \
    http://localhost:8000/repos/ingest \
    -H 'Content-Type: application/json' \
    -d '{
  "github_url" : "https://github.com/Prayag2003/across-protocol-discord-bot"
}'
```

---

To chat with a GitHub repository, send a POST request to `/query` endpoint:

![Query Repo](assets/query.png)

```bash
curl -X POST \
    http://localhost:8000/query \
    -H 'Content-Type: application/json' \
    -d '{
  "repo_id": "ab4de4a4-6262-4dfa-8f68-9863d5a7082d",
  "query": "what does this codebase does?"
}'
```

The server will run on `http://localhost:8000` by default.

### Prerequisites

- Python 3.7+
- Poetry package manager

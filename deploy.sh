#!/bin/bash
set -e

echo "🚀 Starting Githubify deployment on Amazon Linux..."

# 1️⃣ Update system
sudo yum update -y

# 2️⃣ Install base dependencies
sudo yum install -y git python3 python3-pip curl

# 3️⃣ Install UV package manager
echo "📦 Installing UV..."
curl -LsSf https://astral.sh/uv/install.sh | sh

# Make sure uv is available in PATH
export PATH="$HOME/.local/bin:$PATH"

# 4️⃣ Clone or update repository
if [ ! -d "githubify-ethereum-bots-futurestack-hack" ]; then
    echo "📁 Cloning repository..."
    git clone https://github.com/Prayag2003/githubify-ethereum-bots-futurestack-hack
else
    echo "📥 Updating repository..."
    cd githubify-ethereum-bots-futurestack-hack
    git pull
    cd ..
fi

# 5️⃣ Navigate to server directory
cd githubify-ethereum-bots-futurestack-hack/server

# 6️⃣ Create and activate virtual environment
echo "🧱 Setting up virtual environment..."
uv venv
source .venv/bin/activate

# 7️⃣ Install Python dependencies (from requirements + uvicorn)
echo "📚 Installing dependencies..."
uv pip install -r requirements.txt
uv pip install uvicorn --upgrade

# 8️⃣ Launch FastAPI app
echo "🚀 Launching FastAPI server..."
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

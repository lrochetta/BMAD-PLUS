FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
# chromadb needs build tools (gcc, g++)
RUN apt-get update && apt-get install -y \
    git \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements FIRST (cache layer optimization)
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy server code and knowledge structure
COPY . .

# Expose port
EXPOSE 8000

# Run server
CMD ["python", "server.py"]

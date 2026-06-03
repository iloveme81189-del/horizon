FROM ubuntu:22.04

# Avoid tzdata prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install Node 18 and Python 3.12
RUN apt-get update && apt-get install -y \
    curl \
    git \
    python3.11 \
    python3-pip \
    python3.11-venv \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean

# Create app directory
WORKDIR /app

# Copy dependency files
COPY package*.json ./
COPY requirements.txt ./

# Install Node modules
RUN npm install

# Install Python modules
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy source code
COPY . .

# Expose Node.js port (Render assigns process.env.PORT, usually 10000, but we expose 3000 for local)
EXPOSE 3000 8001

# Add execution permissions to start script
RUN chmod +x start.sh

# Start both servers
CMD ["./start.sh"]

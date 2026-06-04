#!/bin/bash
# Start Python FastAPI server in the background
echo "Starting Python FastAPI Server on port 8001..."
python3 -m uvicorn api.app:app --host 0.0.0.0 --port 8001 &
PYTHON_PID=$!

# Start Node.js Express Server on Render's assigned PORT
echo "Starting Node.js Server..."
node server.js &
NODE_PID=$!

# Wait for any process to exit
wait -n
  
# Exit with status of process that exited first
exit $?

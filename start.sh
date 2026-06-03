#!/bin/bash
# Start Python Flask Backend on port 8001
echo "Starting Python Flask Server..."
python3 api/main.py &
PYTHON_PID=$!

# Start Node.js Express Server on Render's assigned PORT
echo "Starting Node.js Server..."
node server.js &
NODE_PID=$!

# Wait for any process to exit
wait -n
  
# Exit with status of process that exited first
exit $?

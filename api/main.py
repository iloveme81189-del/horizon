import os
import json
import tempfile
from flask import Flask, request, Response, jsonify

app = Flask(__name__)

# ── 1. MarkItDown Upload Handler ──
from markitdown import MarkItDown

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "No file part"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "error": "No selected file"}), 400

    temp_path = None
    try:
        fd, temp_path = tempfile.mkstemp()
        os.close(fd)
        file.save(temp_path)

        md = MarkItDown()
        result = md.convert(temp_path)
        
        content = result.text_content
        if len(content) > 50000:
            content = content[:50000]

        return jsonify({
            "success": True,
            "fileName": file.filename,
            "type": "text",
            "content": content
        })

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)

# ── 2. OpenAI Swarm Orchestrator ──
try:
    from swarm import Swarm, Agent
    from openai import OpenAI
    SWARM_AVAILABLE = True
except ImportError as e:
    SWARM_AVAILABLE = False
    IMPORT_ERROR = str(e)

def get_swarm_client():
    groq_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_key:
        raise ValueError("GROQ_API_KEY is not set.")
    client = OpenAI(
        base_url="https://api.groq.com/openai/v1",
        api_key=groq_key
    )
    return Swarm(client=client)

# Define Agents
def transfer_to_coder():
    return coding_agent

def transfer_to_data_analyst():
    return data_agent

triage_agent = None
coding_agent = None
data_agent = None

if SWARM_AVAILABLE:
    triage_agent = Agent(
        name="Triage Agent",
        instructions="""You are the Horizon Swarm Orchestrator. 
        Determine what the user needs. 
        If they need complex code written or debugged, transfer to the Coder.
        If they need data analyzed or charts generated, transfer to the Data Analyst.
        If it's a simple greeting or general question, answer it directly in a highly professional tone.""",
        functions=[transfer_to_coder, transfer_to_data_analyst]
    )

    coding_agent = Agent(
        name="Coding Agent",
        instructions="""You are an elite Software Engineer. 
        Write highly optimized, clean, and production-ready code. 
        Always wrap code in markdown blocks with the language specified.""",
    )

    data_agent = Agent(
        name="Data Analyst",
        instructions="""You are a Data Scientist. 
        Analyze data thoroughly. If the user asks for a chart, output a valid Plotly JSON configuration wrapped in a ```plotly markdown block.""",
    )

@app.route('/api/swarm', methods=['POST'])
def swarm_chat():
    if not SWARM_AVAILABLE:
        def error_stream():
            yield f"data: {json.dumps({'type': 'delta', 'content': f'⚠️ **Swarm Mode Unavailable**<br>Missing dependencies: `{IMPORT_ERROR}`.'})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        return Response(error_stream(), mimetype='text/event-stream')

    data = request.json or {}
    messages = data.get("messages", [])
    model = data.get("model", "llama-3.3-70b-versatile")
    
    formatted_messages = [{"role": m["role"], "content": m["content"]} for m in messages if m["role"] in ["user", "assistant", "system"]]

    try:
        swarm_client = get_swarm_client()
        
        def generate():
            response = swarm_client.run(
                agent=triage_agent,
                messages=formatted_messages,
                model=model,
            )
            
            final_agent_name = response.agent.name
            meta = f"🤖 **Handled by: {final_agent_name}**\n\n"
            yield f"data: {json.dumps({'type': 'delta', 'content': meta})}\n\n"
            
            content = response.messages[-1]["content"]
            chunk_size = 15
            for i in range(0, len(content), chunk_size):
                chunk = content[i:i+chunk_size]
                yield f"data: {json.dumps({'type': 'delta', 'content': chunk})}\n\n"
            
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        return Response(generate(), mimetype='text/event-stream')

    except Exception as e:
        def err():
            yield f"data: {json.dumps({'type': 'error', 'message': f'Swarm Error: {str(e)}'})}\n\n"
        return Response(err(), mimetype='text/event-stream')

if __name__ == '__main__':
    # Run locally or inside Docker on port 8001
    app.run(host='0.0.0.0', port=8001)

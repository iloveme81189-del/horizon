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
    zhipu_key = os.environ.get("ZHIPU_API_KEY", "")
    if not zhipu_key:
        raise ValueError("ZHIPU_API_KEY is not set.")
    client = OpenAI(
        base_url="https://open.bigmodel.cn/api/paas/v4/",
        api_key=zhipu_key
    )
    return Swarm(client=client)

# ── Specialized Agent Handoff Functions ──
def delegate_to_frontend():
    return frontend_agent

def delegate_to_backend():
    return backend_agent

def delegate_to_data_science():
    return data_science_agent

def delegate_to_devops():
    return devops_agent

ceo_agent = None
frontend_agent = None
backend_agent = None
data_science_agent = None
devops_agent = None

if SWARM_AVAILABLE:
    ceo_agent = Agent(
        name="Horizon CEO",
        instructions="""You are Horizon, the CEO Node and orchestrator of this AI architecture.
        Your mandate is to digest complex technical problems, orchestrate clean codebase architectures, and generate production-ready code with zero placeholders.
        You manage a team of elite specialized bots. Determine what the user needs and delegate tasks to the appropriate sub-agents:
        - For UI, React, HTML/CSS, or visual design, transfer to the Frontend UI/UX Bot.
        - For server logic, APIs, database schemas, or Node.js/Python infrastructure, transfer to the Backend Architect Bot.
        - For data processing, charts (Plotly), Pandas, or machine learning, transfer to the Data Science Bot.
        - For deployment, terminal commands, Docker, or system configurations, transfer to the DevOps/Terminal Bot.
        If the request is a simple greeting or general inquiry, answer it directly in a surgical, authoritative tone, completely stripped of polite filler.""",
        functions=[delegate_to_frontend, delegate_to_backend, delegate_to_data_science, delegate_to_devops]
    )

    frontend_agent = Agent(
        name="Frontend UI/UX Bot",
        instructions="""You are an elite Frontend UI/UX Architect.
        Write highly optimized, clean, and production-ready frontend code (React, HTML, CSS, Next.js).
        Never emit placeholders (e.g., // TODO). Every file must be fully copy-pasteable.
        Always wrap code in markdown blocks with the language specified. Focus on responsive, modern design (Tailwind, animations)."""
    )

    backend_agent = Agent(
        name="Backend Architect Bot",
        instructions="""You are an elite Backend Software Engineer.
        Write highly optimized, clean, and production-ready server code (Node.js, Express, Python, SQL, NoSQL).
        Never emit placeholders (e.g., // TODO). Every file must be fully copy-pasteable.
        Ensure secure API design and robust error handling."""
    )

    data_science_agent = Agent(
        name="Data Science Bot",
        instructions="""You are an elite Data Scientist.
        Analyze data thoroughly. If the user asks for a chart, output a valid Plotly JSON configuration wrapped in a ```plotly markdown block.
        Standardize unstructured content and open data analysis with a structural ledger."""
    )

    devops_agent = Agent(
        name="DevOps/Terminal Bot",
        instructions="""You are an elite DevOps and Systems Engineer.
        Provide precise plain-English command directives targeting specific workspace modules.
        Include explicit terminal commands in bash execution blocks.
        Focus on CI/CD, Docker, Render deployments, and system security."""
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
    model = "glm-4" # Force Zhipu model
    
    formatted_messages = [{"role": m["role"], "content": m["content"]} for m in messages if m["role"] in ["user", "assistant", "system"]]

    try:
        swarm_client = get_swarm_client()
        
        def generate():
            response = swarm_client.run(
                agent=ceo_agent,
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

import os
import json
from flask import Flask, request, Response

app = Flask(__name__)

# Attempt to load Swarm (will fail locally if git is not installed, but works on Vercel)
try:
    from swarm import Swarm, Agent
    from openai import OpenAI
    SWARM_AVAILABLE = True
except ImportError as e:
    SWARM_AVAILABLE = False
    IMPORT_ERROR = str(e)

def get_swarm_client():
    # Use Groq API key but OpenAI SDK for Swarm compatibility
    groq_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_key:
        raise ValueError("GROQ_API_KEY is not set.")
    
    # Initialize OpenAI client pointing to Groq's API
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
            yield f"data: {json.dumps({'type': 'delta', 'content': f'⚠️ **Swarm Mode Unavailable Locally**<br>Missing dependencies: `{IMPORT_ERROR}`.<br>This usually happens because `git` is not installed on your local machine to fetch the OpenAI Swarm package.<br><br>**To fix:** Either install Git locally, or deploy to Vercel where it will work automatically!'})}\n\n"
            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        return Response(error_stream(), mimetype='text/event-stream')

    data = request.json or {}
    messages = data.get("messages", [])
    model = data.get("model", "llama-3.3-70b-versatile")
    
    # Ensure messages are properly formatted for Swarm
    formatted_messages = [{"role": m["role"], "content": m["content"]} for m in messages if m["role"] in ["user", "assistant", "system"]]

    try:
        swarm_client = get_swarm_client()
        
        def generate():
            # Run swarm with streaming
            # Swarm uses standard OpenAI chunking under the hood
            # but currently Swarm's `run` handles handoffs synchronously.
            # For simplicity and Vercel compatibility, we run synchronously and stream the final result.
            # *Note: In a true streaming Swarm setup, we would iterate the generator, but Swarm's stream=True returns a generator of dicts.*
            
            response = swarm_client.run(
                agent=triage_agent,
                messages=formatted_messages,
                model=model,
            )
            
            # The final agent that handled the request
            final_agent_name = response.agent.name
            
            # Yield metadata about which agent handled it
            meta = f"🤖 **Handled by: {final_agent_name}**\n\n"
            yield f"data: {json.dumps({'type': 'delta', 'content': meta})}\n\n"
            
            # Stream the actual text (we fake the stream chunks for the UI)
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

# For local Vercel dev
if __name__ == '__main__':
    app.run(debug=True, port=8001)

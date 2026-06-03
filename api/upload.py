from flask import Flask, request, jsonify
from markitdown import MarkItDown
import os
import tempfile

app = Flask(__name__)

@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"success": False, "error": "No file part"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"success": False, "error": "No selected file"}), 400

    temp_path = None
    try:
        # Save file temporarily
        fd, temp_path = tempfile.mkstemp()
        os.close(fd)
        file.save(temp_path)

        # Parse with markitdown
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

# For Vercel Serverless
if __name__ == '__main__':
    app.run(debug=True, port=8000)

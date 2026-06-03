import sys
import json
from markitdown import MarkItDown

def parse_file(file_path):
    try:
        md = MarkItDown()
        result = md.convert(file_path)
        print(json.dumps({"success": True, "markdown": result.text_content}))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "No file path provided"}))
        sys.exit(1)
        
    parse_file(sys.argv[1])

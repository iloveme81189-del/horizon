import urllib.request
import json

url = "https://horizon-iw1o.onrender.com/api/chat"
data = {
    "model": "llama-3.3-70b-versatile",
    "messages": [{"role": "user", "content": "HI"}]
}
req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers={'Content-Type': 'application/json'})

try:
    with urllib.request.urlopen(req) as response:
        print("Status:", response.status)
        print("Response:", response.read().decode('utf-8'))
except Exception as e:
    print("Error:", e)

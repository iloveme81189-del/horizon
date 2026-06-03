#!/usr/bin/env python3
"""
generate_fernet_key.py
Generate a Fernet encryption key and write it to .env

Usage:
  python generate_fernet_key.py

Requires: pip install cryptography
"""
import os, sys, pathlib

try:
    from cryptography.fernet import Fernet
except ImportError:
    print("Installing cryptography...")
    os.system(f"{sys.executable} -m pip install cryptography")
    from cryptography.fernet import Fernet

key = Fernet.generate_key().decode()
print(f"\n✅  Fernet Key Generated:\n   {key}\n")

env_path = pathlib.Path(__file__).parent / ".env"
template = pathlib.Path(__file__).parent / ".env.template"

if env_path.exists():
    content = env_path.read_text()
    content = content.replace("your_fernet_key_here", key)
    env_path.write_text(content)
    print(f"📝  Updated FERNET_KEY in .env")
elif template.exists():
    content = template.read_text()
    content = content.replace("your_fernet_key_here", key)
    env_path.write_text(content)
    print(f"📝  Created .env from template with FERNET_KEY set")
else:
    print(f"⚠️   Add this to your .env:\n    FERNET_KEY={key}")

print("\n🔒  Keep this key secret. Never commit .env to Git!\n")

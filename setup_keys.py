"""
setup_keys.py -- Horizon API Key Setup
=======================================
Run this once to securely encrypt your DeepSeek & Groq API keys into .env

Usage:
    python setup_keys.py

Requires: pip install cryptography
"""

import os
import sys
import re
import pathlib
import getpass

# Fix Windows console encoding
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

# Auto-install cryptography if missing
try:
    from cryptography.fernet import Fernet
except ImportError:
    print("[*] Installing cryptography library...")
    os.system(f'"{sys.executable}" -m pip install cryptography --quiet')
    from cryptography.fernet import Fernet

# ── Paths
BASE_DIR = pathlib.Path(__file__).parent
ENV_FILE = BASE_DIR / ".env"

# ── Helpers ───────────────────────────────────────────────────
def read_env() -> dict:
    """Parse .env into a key->value dict (skips comments)."""
    env = {}
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                env[k.strip()] = v.strip()
    return env


def write_env_key(key: str, value: str):
    """Update a single key=value in .env, adding it if not present."""
    if not ENV_FILE.exists():
        ENV_FILE.write_text("", encoding="utf-8")

    content = ENV_FILE.read_text(encoding="utf-8")
    pattern = rf"^{re.escape(key)}=.*"
    replacement = f"{key}={value}"

    if re.search(pattern, content, flags=re.MULTILINE):
        content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
    else:
        content = content.rstrip("\n") + f"\n{key}={value}\n"

    ENV_FILE.write_text(content, encoding="utf-8")


def get_or_create_fernet_key(env: dict):
    """Reuse existing FERNET_KEY or generate a new one."""
    existing = env.get("FERNET_KEY", "")
    if existing and not existing.startswith("your_"):
        try:
            f = Fernet(existing.encode())
            print("[KEY] Reusing existing FERNET_KEY from .env\n")
            return f, existing
        except Exception:
            pass
    key_bytes = Fernet.generate_key()
    key_str   = key_bytes.decode()
    print("[KEY] Generated new FERNET_KEY\n")
    return Fernet(key_bytes), key_str


def encrypt_value(fernet: Fernet, plaintext: str) -> str:
    """Return FERNET:<encrypted_token>."""
    return "FERNET:" + fernet.encrypt(plaintext.encode()).decode()


def prompt_api_key(display_name: str, env_key: str, url: str, current: str) -> str | None:
    """Interactively ask for an API key. Returns new value or None to skip."""
    already_set = current and not current.startswith("your_")

    if already_set:
        status = "(already encrypted)" if current.startswith("FERNET:") else "(currently set)"
        choice = input(f"  [{display_name}] {status}. Update? (y/N): ").strip().lower()
        if choice != "y":
            print(f"  => Kept existing {env_key}\n")
            return None

    print(f"  URL : {url}")
    value = getpass.getpass(f"  Paste {display_name} (input hidden): ").strip()
    if not value:
        print(f"  => Skipped {env_key}\n")
        return None
    return value


# ── Main ──────────────────────────────────────────────────────
def main():
    print()
    print("  +--------------------------------------------------+")
    print("  |   Horizon - Secure API Key Setup                 |")
    print("  |   Fernet AES-128 Encryption -> .env              |")
    print("  +--------------------------------------------------+")
    print()

    if not ENV_FILE.exists():
        print("  [!] No .env found - will create it.\n")

    env    = read_env()
    fernet, fernet_key = get_or_create_fernet_key(env)

    # Save FERNET_KEY first
    write_env_key("FERNET_KEY", fernet_key)

    any_updated = False

    # ── DeepSeek ──────────────────────────────────────────────
    print("  --- DeepSeek API Key ----------------------------------")
    ds = prompt_api_key(
        "DeepSeek API Key",
        "DEEPSEEK_API_KEY",
        "https://platform.deepseek.com/api_keys",
        env.get("DEEPSEEK_API_KEY", "")
    )
    if ds:
        enc = encrypt_value(fernet, ds)
        write_env_key("DEEPSEEK_API_KEY", enc)
        print(f"  [OK] DEEPSEEK_API_KEY encrypted and saved to .env\n")
        any_updated = True

    # ── Groq ──────────────────────────────────────────────────
    print("  --- Groq API Key --------------------------------------")
    groq = prompt_api_key(
        "Groq API Key",
        "GROQ_API_KEY",
        "https://console.groq.com/keys",
        env.get("GROQ_API_KEY", "")
    )
    if groq:
        enc = encrypt_value(fernet, groq)
        write_env_key("GROQ_API_KEY", enc)
        print(f"  [OK] GROQ_API_KEY encrypted and saved to .env\n")
        any_updated = True

    # ── Done ──────────────────────────────────────────────────
    print()
    if any_updated:
        print("  +--------------------------------------------------+")
        print("  |  [DONE] .env updated with encrypted API keys!    |")
        print("  |                                                  |")
        print("  |  Restart Horizon:                                |")
        print("  |    > start.bat           (Windows launcher)      |")
        print("  |    > node server.js      (manual)                |")
        print("  +--------------------------------------------------+")
    else:
        print("  [=] No changes made. .env is unchanged.")

    print()
    print("  [SECURITY] Keys are AES-128 encrypted with Fernet.")
    print("  [WARNING]  Never share your .env file.")
    print()


if __name__ == "__main__":
    main()

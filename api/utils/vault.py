import os

def decrypt_env():
    """
    Looks for environment variables starting with 'FERNET:' and decrypts them in-place
    using FERNET_KEY from os.environ.
    """
    fernet_key = os.getenv("FERNET_KEY")
    if not fernet_key:
        return
        
    try:
        from cryptography.fernet import Fernet
        f = Fernet(fernet_key.encode())
    except ImportError:
        print("[Vault] cryptography not installed, skipping python decryption.")
        return
    except Exception as e:
        print(f"[Vault] Failed to initialize Fernet: {e}")
        return

    decrypted_count = 0
    for key, val in os.environ.items():
        if val.startswith("FERNET:"):
            try:
                encrypted_str = val[len("FERNET:"):]
                decrypted = f.decrypt(encrypted_str.encode()).decode()
                os.environ[key] = decrypted
                decrypted_count += 1
                print(f"[Vault] ✅ {key} decrypted in Python memory.")
            except Exception as e:
                print(f"[Vault] ❌ Failed to decrypt {key}: {e}")
                
    if decrypted_count > 0:
        print(f"[Vault] Total keys decrypted: {decrypted_count}")

import os
import firebase_admin
from firebase_admin import credentials, auth

class FirebaseAuthManager:
    def __init__(self):
        self.initialized = False
        self._initialize_sdk()

    def _initialize_sdk(self):
        # Try initializing with service account credentials from environment variables
        # Format can be path to JSON file or raw JSON content or environment variables
        from pathlib import Path
        cred_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT")
        
        # Auto-detect default workspace key if env var is missing
        if not cred_path:
            potential_path = Path(__file__).parent.parent.parent / "glacier-watch-1c62b-firebase-adminsdk-fbsvc-4a1fb004c4.json"
            if potential_path.exists():
                cred_path = str(potential_path)
        
        if cred_path and os.path.exists(cred_path):
            try:
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
                self.initialized = True
                print(f"[FIREBASE] Initialized SDK using service account file at: {cred_path}")
            except Exception as e:
                print(f"[FIREBASE ERROR] Failed to initialize from certificate path: {e}")
        else:
            # Check if default application credentials can be loaded
            try:
                firebase_admin.initialize_app()
                self.initialized = True
                print("[FIREBASE] Initialized SDK using default credentials.")
            except Exception as e:
                print("[FIREBASE WARNING] Firebase Admin SDK could not find default credentials. Running in mock-authentication mode.")
                self.initialized = False

    def verify_token(self, token: str):
        """
        Verifies the Firebase ID token.
        Always supports development-mode mock tokens starting with "mock-token-" for easy testing.
        """
        if token.startswith("mock-token-"):
            print(f"[FIREBASE MOCK] Verifying mock token: {token}")
            email = token.replace("mock-token-", "")
            uid = f"mock-uid-{email.replace('@', '-').replace('.', '-')}"
            return {
                "uid": uid,
                "email": email,
                "email_verified": True,
                "name": email.split("@")[0].capitalize(),
                "firebase": {"sign_in_provider": "custom"}
            }

        if not self.initialized:
            raise Exception("Firebase Admin SDK is not initialized, and this is not a valid mock token.")

        try:
            decoded_token = auth.verify_id_token(token)
            return decoded_token
        except Exception as e:
            print(f"[FIREBASE ERROR] Token verification failed: {e}")
            raise e

# Global singleton
firebase_auth_manager = FirebaseAuthManager()

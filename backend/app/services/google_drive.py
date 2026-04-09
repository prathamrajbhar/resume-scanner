import os
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload
import io

class GoogleDriveService:
    def __init__(self):
        self.scopes = ['https://www.googleapis.com/auth/drive']
        self.creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        self.folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID")
        self.creds = None
        self.service = None
        
        if self.creds_path and os.path.exists(self.creds_path):
            self.creds = service_account.Credentials.from_service_account_file(
                self.creds_path, scopes=self.scopes)
            self.service = build('drive', 'v3', credentials=self.creds)

    def upload_file(self, file_content, filename, mimetype):
        """Uploads a file to Google Drive."""
        if not self.service:
            print("Google Drive service not initialized")
            return None

        file_metadata = {
            'name': filename,
            'parents': [self.folder_id] if self.folder_id else []
        }
        
        # Create media upload
        fh = io.BytesIO(file_content)
        media = MediaFileUpload(filename, mimetype=mimetype, resumable=True)
        # Note: MediaFileUpload typically takes a file path. 
        # For in-memory, we might need a different approach or save to /tmp first.
        
        # Temporary save to /tmp
        temp_path = f"/tmp/{filename}"
        with open(temp_path, "wb") as f:
            f.write(file_content)
            
        media = MediaFileUpload(temp_path, mimetype=mimetype, resumable=True)
        
        file = self.service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id'
        ).execute()
        
        # Cleanup
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
        return file.get('id')

    def list_files(self):
        """Lists files in the specific folder."""
        if not self.service:
            return []
            
        query = f"'{self.folder_id}' in parents" if self.folder_id else ""
        results = self.service.files().list(
            q=query, pageSize=10, fields="nextPageToken, files(id, name)").execute()
        return results.get('files', [])

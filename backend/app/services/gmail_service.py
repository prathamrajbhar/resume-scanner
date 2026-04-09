from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
import base64
import os

class GmailService:
    def __init__(self, token=None):
        self.scopes = ['https://www.googleapis.com/auth/gmail.readonly']
        self.token = token
        self.service = None
        
        if self.token:
            creds = Credentials(self.token)
            self.service = build('gmail', 'v1', credentials=creds)

    def fetch_resumes(self):
        """Fetches emails with attachments that look like resumes."""
        if not self.service:
            return []
            
        # Search for: has:attachment (resume OR cv) filename:pdf
        query = "has:attachment (resume OR cv) (filename:pdf OR filename:doc OR filename:docx)"
        results = self.service.users().messages().list(userId='me', q=query).execute()
        messages = results.get('messages', [])
        
        attachments = []
        for msg in messages:
            message = self.service.users().messages().get(userId='me', id=msg['id']).execute()
            payload = message['payload']
            
            # Find attachments
            parts = payload.get('parts', [])
            for part in parts:
                if part.get('filename') and part.get('body', {}).get('attachmentId'):
                    att_id = part['body']['attachmentId']
                    filename = part['filename']
                    mimetype = part['mimeType']
                    
                    # Fetch actual attachment data
                    attachment = self.service.users().messages().attachments().get(
                        userId='me', messageId=msg['id'], id=att_id).execute()
                    
                    data = base64.urlsafe_b64decode(attachment['data'].encode('UTF-8'))
                    
                    attachments.append({
                        'filename': filename,
                        'data': data,
                        'mimetype': mimetype,
                        'msg_id': msg['id']
                    })
                    
        return attachments

import os
from prisma import Prisma
from dotenv import load_dotenv

load_dotenv()

# Pre-initialized Prisma client
db = Prisma()

async def get_db():
    """
    Dependency to get a Prisma db instance.
    """
    if not db.is_connected():
        await db.connect()
    try:
        yield db
    finally:
        # We don't disconnect here because we want to reuse the connection pool
        pass

async def connect_db():
    if not db.is_connected():
        await db.connect()

async def disconnect_db():
    if db.is_connected():
        await db.disconnect()

# Compatibility wrapper for existing code that might expect 'init_db'
def init_db():
    # Prisma handles schema initialization via 'db push' or 'migrate'
    pass

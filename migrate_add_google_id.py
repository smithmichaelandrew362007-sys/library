import psycopg2
from config import DATABASE_URL
import os
import sqlite3

def migrate():
    print("Running migration to add google_id column...")
    
    # Try PostgreSQL first
    try:
        if DATABASE_URL and DATABASE_URL.startswith("postgres"):
            conn = psycopg2.connect(DATABASE_URL)
            cursor = conn.cursor()
            
            # Check if column exists
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='members' AND column_name='google_id'
            """)
            if not cursor.fetchone():
                print("Adding google_id to PostgreSQL members table...")
                cursor.execute("ALTER TABLE members ADD COLUMN google_id VARCHAR(255) UNIQUE DEFAULT NULL;")
                conn.commit()
            else:
                print("google_id already exists in PostgreSQL.")
            conn.close()
            return
    except Exception as e:
        print(f"PostgreSQL migration failed or not configured: {e}")
        
    # Fallback to SQLite
    db_path = os.path.join(os.path.dirname(__file__), 'database', 'library.db')
    if os.path.exists(db_path):
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT google_id FROM members LIMIT 1")
            print("google_id already exists in SQLite.")
        except sqlite3.OperationalError:
            print("Adding google_id to SQLite members table...")
            cursor.execute("ALTER TABLE members ADD COLUMN google_id UNIQUE DEFAULT NULL;")
            conn.commit()
        conn.close()
    else:
        print("SQLite DB not found.")

if __name__ == '__main__':
    migrate()
    print("Migration finished.")

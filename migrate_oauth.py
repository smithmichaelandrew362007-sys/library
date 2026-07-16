"""
Migration: Add email and google_id columns to members table.
Safe to run multiple times (uses ALTER TABLE IF NOT EXISTS pattern).
"""
from models import get_db

def migrate():
    conn = get_db()
    cursor = conn.cursor()
    
    # Add email column if it doesn't exist
    cursor.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='members' AND column_name='email'
            ) THEN
                ALTER TABLE members ADD COLUMN email VARCHAR(255) DEFAULT '';
            END IF;
        END $$;
    """)
    
    # Add google_id column if it doesn't exist
    cursor.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name='members' AND column_name='google_id'
            ) THEN
                ALTER TABLE members ADD COLUMN google_id VARCHAR(255) UNIQUE DEFAULT NULL;
            END IF;
        END $$;
    """)

    # Make password nullable for Google-only accounts
    cursor.execute("""
        ALTER TABLE members ALTER COLUMN password SET DEFAULT '';
    """)

    conn.commit()
    conn.close()
    print("[OK] Migration complete: email and google_id columns added to members.")

if __name__ == '__main__':
    migrate()

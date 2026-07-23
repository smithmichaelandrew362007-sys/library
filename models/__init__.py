import psycopg2
import psycopg2.extras
import os
import config
from psycopg2.pool import ThreadedConnectionPool

# Global connection pool
_db_pool = None

def init_pool():
    global _db_pool
    import time
    if _db_pool is None:
        for attempt in range(5):
            try:
                _db_pool = ThreadedConnectionPool(
                    1, 5,
                    config.DATABASE_URL,
                    connection_factory=psycopg2.extras.RealDictConnection
                )
                print("[INFO] Database connection pool initialized.")
                return
            except Exception as e:
                print(f"[WARN] Database wake-up retry {attempt+1}/5: {e}")
                time.sleep(2)
        print("[ERROR] Failed to initialize connection pool after 5 attempts.")

class PooledConnectionWrapper:
    """Wrapper to intercept close() and return the connection to the pool."""
    def __init__(self, conn):
        self._conn = conn

    def cursor(self, *args, **kwargs):
        return self._conn.cursor(*args, **kwargs)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        global _db_pool
        if _db_pool and self._conn:
            _db_pool.putconn(self._conn)
            self._conn = None

def get_db():
    """Get a PostgreSQL database connection from the pool, ensuring it's alive."""
    global _db_pool
    if _db_pool is None:
        init_pool()
    
    if _db_pool:
        # Retry up to 3 times to get a live connection
        for _ in range(3):
            conn = _db_pool.getconn()
            try:
                # Ping the connection
                cursor = conn.cursor()
                cursor.execute("SELECT 1")
                cursor.close()
                return PooledConnectionWrapper(conn)
            except psycopg2.OperationalError:
                # Connection is dead, throw it away (close it properly)
                try:
                    _db_pool.putconn(conn, close=True)
                except Exception:
                    pass
        # If we failed to get a live one from pool, try making a fresh one
        return psycopg2.connect(config.DATABASE_URL, connection_factory=psycopg2.extras.RealDictConnection)
    else:
        # Fallback if pool fails to initialize
        return psycopg2.connect(config.DATABASE_URL, connection_factory=psycopg2.extras.RealDictConnection)
def init_database():
    """
    Initialize the database: create it if it doesn't exist,
    then run the schema SQL script.
    """
    try:
        conn = get_db()
        cursor = conn.cursor()

        # Check if tables already exist
        cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='books'")
        
        if not cursor.fetchone():
            print("[INFO] Initializing PostgreSQL database...")
            # Read and execute the SQL file
            sql_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'database', 'library.sql')
            with open(sql_path, 'r') as f:
                sql_content = f.read()

            cursor.execute(sql_content)

            # Now hash the passwords properly for seeded users
            from werkzeug.security import generate_password_hash
            admin_hash = generate_password_hash('admin123')
            # Student passwords are stored in plain text per user request
            student_pw = 'student123'

            cursor.execute("UPDATE members SET password = %s WHERE role = 'admin'", (admin_hash,))
            cursor.execute("UPDATE members SET password = %s WHERE role = 'student'", (student_pw,))

            print("[OK] PostgreSQL Database initialized with schema and seed data.")
        else:
            print("[OK] PostgreSQL Database already exists, skipping initialization.")
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_issues_member_status ON issue_records(member_id, status);
                CREATE INDEX IF NOT EXISTS idx_issues_issue_date ON issue_records(issue_date);
                CREATE INDEX IF NOT EXISTS idx_members_role_status ON members(role, status);
                CREATE INDEX IF NOT EXISTS idx_issues_fine_paid ON issue_records(fine_paid);
            """)
            print("[OK] Verified performance indexes.")

        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[ERROR] Failed to connect or initialize DB: {e}")

import os
from dotenv import load_dotenv
from psycopg2.pool import SimpleConnectionPool
from psycopg2.extras import RealDictCursor

load_dotenv()

pool = SimpleConnectionPool(
    minconn=1,
    maxconn=10,
    host=os.getenv("DB_HOST"),
    port=os.getenv("DB_PORT"),
    database=os.getenv("DB_NAME"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD")
)

# ---------- READ (SELECT) ----------
def fetch_all(query, params=None):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params)
            return cur.fetchall()
    finally:
        pool.putconn(conn)


# ---------- READ ONE ----------
def fetch_one(query, params=None):
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params)
            return cur.fetchone()
    finally:
        pool.putconn(conn)


# ---------- WRITE (INSERT / UPDATE / DELETE) ----------
def execute(query, params=None):
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            conn.commit()
    finally:
        pool.putconn(conn)


# ---------- WRITE WITH RETURN (INSERT RETURNING) ----------
def execute_returning(query, params=None):
    """Execute query and return the result (useful for INSERT ... RETURNING)"""
    conn = pool.getconn()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            result = cur.fetchone()
            conn.commit()
            return result[0] if result else None
    finally:
        pool.putconn(conn)

def execute_returning_dict(query, params=None):
    """Execute query and return the result as a dictionary (useful for INSERT ... RETURNING *)"""
    conn = pool.getconn()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params)
            result = cur.fetchone()
            conn.commit()
            return result
    finally:
        pool.putconn(conn)
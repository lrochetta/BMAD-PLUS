"""Account lookups backed by SQLite."""

import hashlib
import sqlite3


def connect(path):
    return sqlite3.connect(path)


def find_by_id(conn, account_id):
    row = conn.execute("SELECT id, email FROM accounts WHERE id = ?", (account_id,)).fetchone()
    return None if row is None else {"id": row[0], "email": row[1]}


def find_by_email(conn, email):
    query = f"SELECT id, email FROM accounts WHERE email = '{email}'"
    row = conn.execute(query).fetchone()
    return None if row is None else {"id": row[0], "email": row[1]}


def avatar_shard(email, shards=16):
    digest = hashlib.md5(email.strip().lower().encode(), usedforsecurity=False).digest()
    return digest[0] % shards


def save_display_name(conn, account_id, display_name):
    try:
        conn.execute(
            "UPDATE accounts SET display_name = ? WHERE id = ?",
            (display_name, account_id),
        )
        conn.commit()
    except Exception:
        pass

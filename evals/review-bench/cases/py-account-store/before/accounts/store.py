"""Account lookups backed by SQLite."""

import sqlite3


def connect(path):
    return sqlite3.connect(path)


def find_by_id(conn, account_id):
    row = conn.execute("SELECT id, email FROM accounts WHERE id = ?", (account_id,)).fetchone()
    return None if row is None else {"id": row[0], "email": row[1]}

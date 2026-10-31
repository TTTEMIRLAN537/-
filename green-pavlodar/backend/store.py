"""Хранилище данных сайта (зоны, расставленные объекты, палитра) одним документом с номером ревизии.

* PostgresStore — постоянное хранилище (Neon, Supabase, любой Postgres): задайте DATABASE_URL.
* FileStore — JSON-файл: подходит для локального запуска и VPS с постоянным диском.
  На бесплатных хостингах без постоянного диска (например, Render Free) файл пропадает при перезапуске!

Ревизия защищает от затирания: запись принимается, только если клиент видел последнюю версию.
"""
import json
import os
import tempfile
import threading
from typing import Optional, Tuple

import config


class RevConflict(Exception):
    """Данные на сервере новее, чем те, на основе которых сделана правка."""

    def __init__(self, current_rev: int):
        super().__init__(f"Текущая ревизия {current_rev}")
        self.current_rev = current_rev


class FileStore:
    kind = "file"
    persistent = False  # заранее не знаем, есть ли у диска сохранность между перезапусками

    def __init__(self, path: str):
        self.path = path
        self._lock = threading.Lock()

    def _read(self) -> dict:
        try:
            with open(self.path, encoding="utf-8") as f:
                return json.load(f)
        except (FileNotFoundError, ValueError):
            return {"rev": 0, "data": None}

    def get(self) -> Tuple[int, Optional[dict]]:
        with self._lock:
            doc = self._read()
        return doc["rev"], doc["data"]

    def save(self, data: dict, base_rev: int) -> int:
        with self._lock:
            doc = self._read()
            if doc["rev"] != base_rev:
                raise RevConflict(doc["rev"])
            new = {"rev": base_rev + 1, "data": data}
            os.makedirs(os.path.dirname(os.path.abspath(self.path)), exist_ok=True)
            fd, tmp = tempfile.mkstemp(dir=os.path.dirname(os.path.abspath(self.path)), suffix=".tmp")
            try:
                with os.fdopen(fd, "w", encoding="utf-8") as f:
                    json.dump(new, f, ensure_ascii=False)
                os.replace(tmp, self.path)  # атомарная замена: файл не бывает записан наполовину
            finally:
                if os.path.exists(tmp):
                    os.remove(tmp)
            return new["rev"]


class PostgresStore:
    kind = "postgres"
    persistent = True

    def __init__(self, url: str):
        import psycopg  # импорт здесь, чтобы без Postgres драйвер не требовался
        self._psycopg = psycopg
        self.url = url
        with self._connect() as conn:
            conn.execute(
                "CREATE TABLE IF NOT EXISTS app_state ("
                "key text PRIMARY KEY, value text NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())"
            )

    def _connect(self):
        return self._psycopg.connect(self.url, connect_timeout=15)

    def get(self) -> Tuple[int, Optional[dict]]:
        with self._connect() as conn:
            row = conn.execute("SELECT value FROM app_state WHERE key = 'main'").fetchone()
        if not row:
            return 0, None
        doc = json.loads(row[0])
        return doc["rev"], doc["data"]

    def save(self, data: dict, base_rev: int) -> int:
        with self._connect() as conn:  # выход из with без ошибки = commit
            conn.execute(
                "INSERT INTO app_state (key, value) VALUES ('main', %s) ON CONFLICT (key) DO NOTHING",
                (json.dumps({"rev": 0, "data": None}),),
            )
            row = conn.execute("SELECT value FROM app_state WHERE key = 'main' FOR UPDATE").fetchone()
            cur = json.loads(row[0])
            if cur["rev"] != base_rev:
                raise RevConflict(cur["rev"])
            new = {"rev": base_rev + 1, "data": data}
            conn.execute(
                "UPDATE app_state SET value = %s, updated_at = now() WHERE key = 'main'",
                (json.dumps(new, ensure_ascii=False),),
            )
            return new["rev"]


def make_store():
    if config.DATABASE_URL:
        return PostgresStore(config.DATABASE_URL)
    return FileStore(config.DATA_FILE)

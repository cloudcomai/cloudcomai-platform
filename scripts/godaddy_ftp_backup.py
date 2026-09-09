#!/usr/bin/env python3
import ftplib
import os
import pathlib
import posixpath
import sys

HOST = os.environ["FTP_SERVER"]
USER = os.environ["FTP_USERNAME"]
PASSWORD = os.environ["FTP_PASSWORD"]
REMOTE_ROOT = os.environ["GODADDY_API_DIR"].rstrip("/")
LOCAL_ROOT = pathlib.Path(os.environ.get("BACKUP_DIR", ".deploy/production-backup"))
EXCLUDED_TOP_LEVEL = {"config", "storage", "deploy-migrations"}

def connect():
    ftp = ftplib.FTP(HOST, timeout=30)
    ftp.login(USER, PASSWORD)
    ftp.set_pasv(True)
    return ftp

def list_entries(ftp, remote_dir):
    try:
        entries = list(ftp.mlsd(remote_dir))
        return [(name, facts.get("type", "")) for name, facts in entries if name not in {".", ".."}]
    except Exception:
        names = ftp.nlst(remote_dir)
        result = []
        for raw in names:
            name = posixpath.basename(raw.rstrip("/"))
            if not name:
                continue
            path = posixpath.join(remote_dir, name)
            current = ftp.pwd()
            try:
                ftp.cwd(path)
                ftp.cwd(current)
                kind = "dir"
            except Exception:
                kind = "file"
            result.append((name, kind))
        return result

def download_tree(ftp, remote_dir, local_dir, top_level=True):
    local_dir.mkdir(parents=True, exist_ok=True)
    for name, kind in list_entries(ftp, remote_dir):
        if top_level and name in EXCLUDED_TOP_LEVEL:
            continue
        remote_path = posixpath.join(remote_dir, name)
        local_path = local_dir / name
        if kind == "dir":
            download_tree(ftp, remote_path, local_path, top_level=False)
        else:
            local_path.parent.mkdir(parents=True, exist_ok=True)
            with local_path.open("wb") as fh:
                ftp.retrbinary(f"RETR {remote_path}", fh.write)

def ensure_remote_dir(ftp, remote_dir):
    parts = [p for p in remote_dir.split("/") if p]
    current = "/" if remote_dir.startswith("/") else ""
    for part in parts:
        current = posixpath.join(current, part) if current else part
        try:
            ftp.mkd(current)
        except Exception:
            pass

def delete_remote_tree(ftp, remote_dir, top_level=True):
    for name, kind in list_entries(ftp, remote_dir):
        if top_level and name in EXCLUDED_TOP_LEVEL:
            continue
        path = posixpath.join(remote_dir, name)
        if kind == "dir":
            delete_remote_tree(ftp, path, top_level=False)
            try:
                ftp.rmd(path)
            except Exception:
                pass
        else:
            ftp.delete(path)

def upload_tree(ftp, local_dir, remote_dir):
    ensure_remote_dir(ftp, remote_dir)
    for path in sorted(local_dir.iterdir()):
        remote_path = posixpath.join(remote_dir, path.name)
        if path.is_dir():
            upload_tree(ftp, path, remote_path)
        else:
            with path.open("rb") as fh:
                ftp.storbinary(f"STOR {remote_path}", fh)

def verify_backup():
    files = [p for p in LOCAL_ROOT.rglob("*") if p.is_file()]
    if not files:
        raise RuntimeError("FTP backup contains no files")
    required = [LOCAL_ROOT / "api", LOCAL_ROOT / "lib"]
    if not all(p.is_dir() for p in required):
        raise RuntimeError("FTP backup is missing required api/lib directories")
    total = sum(p.stat().st_size for p in files)
    print(f"Backed up {len(files)} files ({total} bytes) from {REMOTE_ROOT}")
    return total

def main():
    if len(sys.argv) != 2 or sys.argv[1] not in {"backup", "restore"}:
        raise SystemExit("Usage: godaddy_ftp_backup.py backup|restore")
    action = sys.argv[1]
    ftp = connect()
    try:
        if action == "backup":
            if LOCAL_ROOT.exists():
                import shutil
                shutil.rmtree(LOCAL_ROOT)
            download_tree(ftp, REMOTE_ROOT, LOCAL_ROOT)
            verify_backup()
        else:
            verify_backup()
            delete_remote_tree(ftp, REMOTE_ROOT)
            upload_tree(ftp, LOCAL_ROOT, REMOTE_ROOT)
            print("FTP rollback completed; config, storage, and deploy-migrations were preserved.")
    finally:
        try:
            ftp.quit()
        except Exception:
            ftp.close()

if __name__ == "__main__":
    main()

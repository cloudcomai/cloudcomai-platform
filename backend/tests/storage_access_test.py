"""Exercise the shipped .htaccess in Apache, including subdirectory installs."""
import grp
import os
from pathlib import Path
import pwd
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request


backend = Path(__file__).resolve().parents[1]
apache = shutil.which("apache2") or "/usr/sbin/apache2"
modules = Path("/usr/lib/apache2/modules")

with tempfile.TemporaryDirectory(prefix="cloudcomai-apache-test-") as directory:
    root = Path(directory)
    root.chmod(0o755)
    document_root = root / "www"
    document_root.mkdir()
    protected_paths = [
        "storage/attachments/fixture.png", "storage/uploads/fixture.json",
        "config/config.php", "database/fresh-install.sql", "sql/schema.sql",
        "lib/bootstrap.php", "tests/fixture.txt", "cron/send_notifications.php",
        "cron_cleanup.php", "error_log", "cron_debug.log",
    ]
    public_paths = ["api/health.txt", "uploads/users/1.png", "uploads/groups/1.png"]
    for prefix in ["", "apiapp/"]:
        application = document_root / prefix
        application.mkdir(exist_ok=True)
        shutil.copyfile(backend / ".htaccess", application / ".htaccess")
        for relative in protected_paths + public_paths:
            fixture = application / relative
            fixture.parent.mkdir(parents=True, exist_ok=True)
            fixture.write_text("local-access-test-fixture")

    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    user = "www-data" if os.geteuid() == 0 else pwd.getpwuid(os.geteuid()).pw_name
    group = "www-data" if os.geteuid() == 0 else grp.getgrgid(os.getegid()).gr_name
    configuration = root / "httpd.conf"
    configuration.write_text(f'''
ServerRoot "{root}"
ServerName 127.0.0.1
Listen 127.0.0.1:{port}
PidFile "{root}/httpd.pid"
ErrorLog "{root}/error.log"
LoadModule mpm_event_module "{modules}/mod_mpm_event.so"
LoadModule authz_core_module "{modules}/mod_authz_core.so"
LoadModule rewrite_module "{modules}/mod_rewrite.so"
LoadModule headers_module "{modules}/mod_headers.so"
User {user}
Group {group}
DocumentRoot "{document_root}"
<Directory "{document_root}">
    Options FollowSymLinks
    AllowOverride All
    Require all granted
</Directory>
''')
    process = subprocess.Popen([apache, "-f", str(configuration), "-DFOREGROUND"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)

    def status(path):
        try:
            with urllib.request.urlopen(f"http://127.0.0.1:{port}/{path}", timeout=5) as response:
                return response.status
        except urllib.error.HTTPError as error:
            return error.code

    try:
        for attempt in range(50):
            if process.poll() is not None:
                raise RuntimeError(process.stdout.read().decode())
            try:
                status("api/health.txt")
                break
            except urllib.error.URLError:
                time.sleep(0.1)
        for prefix in ["", "apiapp/"]:
            for path in protected_paths:
                actual = status(prefix + path)
                assert actual == 403, f"{prefix}{path}: expected 403, got {actual}"
            for path in public_paths:
                actual = status(prefix + path)
                assert actual == 200, f"{prefix}{path}: expected 200, got {actual}"
        print("Apache storage protection passed for root and subdirectory deployments")
    except BaseException:
        if (root / "error.log").exists():
            print((root / "error.log").read_text())
        raise
    finally:
        process.terminate()
        try:
            process.communicate(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.communicate()

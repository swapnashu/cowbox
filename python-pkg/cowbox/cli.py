import argparse
import subprocess
import sys
import os
import json
import secrets
import tempfile
import shutil
import urllib.request
from . import __version__

SYSTEMD_UNIT_TEMPLATE = """[Unit]
Description=Cowbox PaaS Management Hub
Documentation=https://github.com/swapnashu/cowbox
After=docker.service network-online.target
Requires=docker.service
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/bin/docker start cowbox-server
ExecStop=/usr/bin/docker stop -t 15 cowbox-server
ExecReload=/usr/bin/docker restart cowbox-server

[Install]
WantedBy=multi-user.target
"""

def check_docker():
    try:
        subprocess.run(["docker", "info"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

def parse_semver(v):
    cleaned = v.lstrip("vV").strip()
    parts = []
    for part in cleaned.split("."):
        try:
            parts.append(int(part))
        except ValueError:
            parts.append(0)
    while len(parts) < 3:
        parts.append(0)
    return parts[:3]

def check_for_updates():
    try:
        req = urllib.request.Request(
            "https://pypi.org/pypi/cowbox/json",
            headers={"User-Agent": f"cowbox-cli/{__version__}"}
        )
        with urllib.request.urlopen(req, timeout=2.5) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                latest_version = data.get("info", {}).get("version", __version__)
                if parse_semver(latest_version) > parse_semver(__version__):
                    return True, latest_version
    except Exception:
        pass
    return False, __version__

def print_update_banner_if_available():
    has_update, latest_ver = check_for_updates()
    if has_update:
        print("\n" + "─" * 55)
        print(f" ✨ Cowbox Update Available! v{__version__} ➜ v{latest_ver}")
        print(f" Run: pip install --upgrade cowbox && cowbox restart")
        print(f" PyPI: https://pypi.org/project/cowbox/{latest_ver}/")
        print("─" * 55 + "\n")

def manage_service(action):
    service_file = "/etc/systemd/system/cowbox.service"
    
    if action == "install":
        print("📦 Installing Cowbox systemd autostart service...")
        if os.name == "nt":
            print("❌ Error: systemd is only supported on Linux distributions.")
            sys.exit(1)
        
        try:
            with open(service_file, "w") as f:
                f.write(SYSTEMD_UNIT_TEMPLATE)
            
            subprocess.run(["systemctl", "daemon-reload"], check=True)
            subprocess.run(["systemctl", "enable", "cowbox.service"], check=True)
            print("✅ cowbox.service installed and enabled to autostart on system boot!")
            print("To start the service now: systemctl start cowbox.service")
        except PermissionError:
            print("❌ Permission denied. Please run with sudo: sudo cowbox service install")
            sys.exit(1)
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to enable service: {e}")
            sys.exit(1)

    elif action == "status":
        if os.name == "nt":
            print("❌ Error: systemd is only supported on Linux distributions.")
            sys.exit(1)
        subprocess.run(["systemctl", "status", "cowbox.service"])

    elif action == "uninstall":
        if os.name == "nt":
            print("❌ Error: systemd is only supported on Linux distributions.")
            sys.exit(1)
        try:
            subprocess.run(["systemctl", "disable", "cowbox.service"], check=False)
            if os.path.exists(service_file):
                os.remove(service_file)
            subprocess.run(["systemctl", "daemon-reload"], check=True)
            print("✅ cowbox.service successfully uninstalled.")
        except PermissionError:
            print("❌ Permission denied. Please run with sudo: sudo cowbox service uninstall")
            sys.exit(1)

def main():
    parser = argparse.ArgumentParser(
        prog="cowbox",
        description=f"Cowbox CLI (v{__version__}) - Self-Hosted PaaS Management Hub"
    )
    parser.add_argument("-v", "--version", action="version", version=f"Cowbox v{__version__}")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # START command
    start_parser = subparsers.add_parser("start", help="Build and start the Cowbox server")
    start_parser.add_argument("-p", "--port", type=int, default=int(os.getenv("COWBOX_PORT", os.getenv("PORT", "9999"))),
                              help="Port to expose Cowbox on (default: 9999)")
    start_parser.add_argument("-e", "--email", type=str, default=os.getenv("COWBOX_ADMIN_EMAIL", os.getenv("ADMIN_EMAIL", "")),
                              help="Administrator email (or COWBOX_ADMIN_EMAIL env)")
    start_parser.add_argument("--password", type=str, default=os.getenv("COWBOX_ADMIN_PASSWORD", os.getenv("ADMIN_PASSWORD", "")),
                              help="Administrator password (or COWBOX_ADMIN_PASSWORD env)")
    start_parser.add_argument("-d", "--data-dir", type=str, default=os.getenv("COWBOX_DATA_DIR", os.getenv("DATA_DIR", "")),
                              help="Host path for persistent DB & storage volume (e.g. /var/lib/cowbox)")
    start_parser.add_argument("--letsencrypt-email", type=str, default=os.getenv("LETSENCRYPT_EMAIL", ""),
                              help="Let's Encrypt notification email for SSL certificates")
    start_parser.add_argument("--restart", type=str, default="unless-stopped",
                              help="Docker restart policy (default: unless-stopped)")
    start_parser.add_argument("-y", "--non-interactive", action="store_true",
                              help="Run non-interactively without prompt prompts")

    # STOP command
    subparsers.add_parser("stop", help="Stop the Cowbox server")

    # RESTART command
    subparsers.add_parser("restart", help="Restart the Cowbox server")

    # STATUS command
    subparsers.add_parser("status", help="Show Cowbox server status and check for updates")

    # UPDATE command
    subparsers.add_parser("update", help="Check and upgrade Cowbox to the latest version")

    # SERVICE command (systemd autostart)
    service_parser = subparsers.add_parser("service", help="Manage systemd autostart service")
    service_parser.add_argument("action", choices=["install", "status", "uninstall"],
                                help="Service action (install, status, uninstall)")

    # LOGS command
    logs_parser = subparsers.add_parser("logs", help="View Cowbox server logs")
    logs_parser.add_argument("-f", "--follow", action="store_true", help="Follow log output")
    logs_parser.add_argument("-n", "--lines", type=str, default="100", help="Number of lines to show (default: 100)")

    args = parser.parse_args()

    if args.command == "start":
        if not check_docker():
            print("❌ Error: Docker is not running or not installed. Cowbox requires Docker.")
            sys.exit(1)

        print_update_banner_if_available()

        email = args.email
        password = args.password
        port = args.port

        print("🐮 Welcome to Cowbox!")

        # Interactive setup if credentials not provided via flags/env and not in non-interactive mode
        if not args.non-interactive and (not email or not password):
            print("Set up your master administrator account:")
            if not email:
                email_input = input("Admin Email [default: admin@cowbox.io]: ").strip()
                email = email_input if email_input else "admin@cowbox.io"
            if not password:
                generated_pass = secrets.token_urlsafe(16)
                pwd_input = input(f"Admin Password [leave blank to auto-generate secure password]: ").strip()
                password = pwd_input if pwd_input else generated_pass

        # Fallbacks for non-interactive mode without flags
        if not email:
            email = "admin@cowbox.io"
        if not password:
            password = secrets.token_urlsafe(16)

        print(f"\n🚀 Preparing Cowbox on port {port}...")

        temp_dir = tempfile.mkdtemp()
        print(f"Downloading latest Cowbox version from GitHub...")
        try:
            subprocess.run(["git", "clone", "--depth", "1", "https://github.com/swapnashu/cowbox.git", temp_dir], check=True)

            print("Building Docker image (this may take a few minutes on first run)...")
            subprocess.run(["docker", "build", "-t", "cowbox:latest", temp_dir], check=True)

            print(f"\nStarting container with restart policy: {args.restart}")

            # Ensure container isn't already running
            subprocess.run(["docker", "rm", "-f", "cowbox-server"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            # Resolve stable persistent volume
            if args.data_dir:
                abs_data_dir = os.path.abspath(args.data_dir)
                os.makedirs(abs_data_dir, exist_ok=True)
                volume_mapping = f"{abs_data_dir}:/app/data"
            else:
                volume_mapping = "cowbox-data:/app/data"

            run_cmd = [
                "docker", "run", "-d",
                "--name", "cowbox-server",
                "--restart", args.restart,
                "-p", f"{port}:9999",
                "-v", "/var/run/docker.sock:/var/run/docker.sock",
                "-v", volume_mapping,
                "-e", "COWBOX_DATA_DIR=/app/data",
                "-e", f"ADMIN_EMAIL={email}",
                "-e", f"ADMIN_PASSWORD={password}",
            ]

            if args.letsencrypt_email:
                run_cmd.extend(["-e", f"LETSENCRYPT_EMAIL={args.letsencrypt_email}"])

            run_cmd.append("cowbox:latest")

            subprocess.run(run_cmd, check=True)
            print("\n" + "=" * 50)
            print("✅ Cowbox is successfully running!")
            print(f"🔗 Dashboard: http://localhost:{port}")
            print(f"📧 Admin Email:    {email}")
            print(f"🔑 Admin Password: {password}")
            print(f"💾 Persistent DB:  {volume_mapping}")
            print("=" * 50)
            print("Tip: Use 'cowbox logs -f' to view live logs or 'cowbox stop' to stop.")

        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to start Cowbox: {e}")
            sys.exit(1)
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    elif args.command == "service":
        manage_service(args.action)

    elif args.command == "stop":
        print("Stopping Cowbox...")
        res = subprocess.run(["docker", "stop", "cowbox-server"])
        if res.returncode == 0:
            print("✅ Cowbox stopped.")
        else:
            print("❌ Cowbox is not running or failed to stop.")

    elif args.command == "restart":
        print("Restarting Cowbox...")
        res = subprocess.run(["docker", "restart", "cowbox-server"])
        if res.returncode == 0:
            print("✅ Cowbox restarted.")
        else:
            print("❌ Cowbox is not running or failed to restart.")

    elif args.command == "status":
        print(f"🐮 Cowbox CLI v{__version__}")
        res = subprocess.run(["docker", "ps", "--filter", "name=cowbox-server", "--format", "table {{.Names}}\t{{.Status}}\t{{.Ports}}"])
        if res.returncode != 0:
            print("❌ Failed to query Docker status.")
        print_update_banner_if_available()

    elif args.command == "update":
        print("🔍 Checking for Cowbox updates on PyPI...")
        has_update, latest_ver = check_for_updates()
        if not has_update:
            print(f"✅ Cowbox is already up to date (v{__version__}).")
            sys.exit(0)

        print(f"🚀 New version found: v{__version__} ➜ v{latest_ver}")
        print("Upgrading Python package...")
        res = subprocess.run([sys.executable, "-m", "pip", "install", "--upgrade", "cowbox"])
        if res.returncode != 0:
            print("❌ Failed to upgrade python package.")
            sys.exit(1)

        print(f"✅ Upgraded to Cowbox v{latest_ver}!")
        print("To restart the server with the latest release, run:")
        print("  cowbox start")

    elif args.command == "logs":
        cmd = ["docker", "logs", "--tail", args.lines]
        if args.follow:
            cmd.append("-f")
        cmd.append("cowbox-server")
        subprocess.run(cmd)

    else:
        parser.print_help()

if __name__ == "__main__":
    main()

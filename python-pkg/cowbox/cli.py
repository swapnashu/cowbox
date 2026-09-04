import argparse
import subprocess
import sys
import os
import secrets
import tempfile
import shutil

def check_docker():
    try:
        subprocess.run(["docker", "info"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

def main():
    parser = argparse.ArgumentParser(
        prog="cowbox",
        description="Cowbox CLI - Self-Hosted PaaS Management Hub"
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # START command
    start_parser = subparsers.add_parser("start", help="Build and start the Cowbox server")
    start_parser.add_argument("-p", "--port", type=int, default=int(os.getenv("COWBOX_PORT", os.getenv("PORT", "9999"))),
                              help="Port to expose Cowbox on (default: 9999)")
    start_parser.add_argument("-e", "--email", type=str, default=os.getenv("COWBOX_ADMIN_EMAIL", os.getenv("ADMIN_EMAIL", "")),
                              help="Administrator email (or COWBOX_ADMIN_EMAIL env)")
    start_parser.add_argument("--password", type=str, default=os.getenv("COWBOX_ADMIN_PASSWORD", os.getenv("ADMIN_PASSWORD", "")),
                              help="Administrator password (or COWBOX_ADMIN_PASSWORD env)")
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
    subparsers.add_parser("status", help="Show Cowbox server status")

    # LOGS command
    logs_parser = subparsers.add_parser("logs", help="View Cowbox server logs")
    logs_parser.add_argument("-f", "--follow", action="store_true", help="Follow log output")
    logs_parser.add_argument("-n", "--lines", type=str, default="100", help="Number of lines to show (default: 100)")

    args = parser.parse_args()

    if args.command == "start":
        if not check_docker():
            print("❌ Error: Docker is not running or not installed. Cowbox requires Docker.")
            sys.exit(1)

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

            print("\nStarting container with restart policy:", args.restart)

            # Ensure container isn't already running
            subprocess.run(["docker", "rm", "-f", "cowbox-server"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

            run_cmd = [
                "docker", "run", "-d",
                "--name", "cowbox-server",
                "--restart", args.restart,
                "-p", f"{port}:9999",
                "-v", "/var/run/docker.sock:/var/run/docker.sock",
                "-v", "cowbox-data:/app/data",
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
            print("=" * 50)
            print("Tip: Use 'cowbox logs -f' to view live logs or 'cowbox stop' to stop.")

        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to start Cowbox: {e}")
            sys.exit(1)
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

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
        res = subprocess.run(["docker", "ps", "--filter", "name=cowbox-server", "--format", "table {{.Names}}\t{{.Status}}\t{{.Ports}}"])
        if res.returncode != 0:
            print("❌ Failed to query Docker status.")

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

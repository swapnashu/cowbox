import argparse
import subprocess
import sys
import os

def check_docker():
    try:
        subprocess.run(["docker", "info"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

def main():
    parser = argparse.ArgumentParser(description="Cowbox - Self-Hosted PaaS Management Hub")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    start_parser = subparsers.add_parser("start", help="Start the Cowbox server")
    stop_parser = subparsers.add_parser("stop", help="Stop the Cowbox server")
    logs_parser = subparsers.add_parser("logs", help="View Cowbox server logs")
    
    args = parser.parse_args()

    if args.command == "start":
        if not check_docker():
            print("❌ Error: Docker is not running or not installed. Cowbox requires Docker.")
            sys.exit(1)
        
        print("🐮 Welcome to Cowbox!")
        print("Let's set up your master administrator account.")
        email = input("Admin Email [default: cowbox@cowbox.io]: ").strip()
        if not email:
            email = "cowbox@cowbox.io"
            
        password = input("Admin Password [default: cowbox#1234]: ").strip()
        if not password:
            password = "cowbox#1234"

        print(f"\n🚀 Starting Cowbox on port 9999...")
        
        # We assume the user has the code cloned locally for this implementation,
        # but in a real PyPI package we would extract the bundled code or pull the Docker image.
        # Here we just run docker-compose or docker run using the current directory.
        
        cwd = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
        
        print(f"Building Docker image from {cwd} (this may take a few minutes)...")
        try:
            subprocess.run(["docker", "build", "-t", "cowbox:latest", cwd], check=True)
            
            print("\nStarting container...")
            
            # Ensure container isn't already running
            subprocess.run(["docker", "rm", "-f", "cowbox-server"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            
            # Windows/Linux docker socket mount differences are handled automatically by Docker Desktop, 
            # but on Windows it's //var/run/docker.sock. Docker usually accepts /var/run/docker.sock everywhere now.
            run_cmd = [
                "docker", "run", "-d",
                "--name", "cowbox-server",
                "-p", "9999:9999",
                "-v", "/var/run/docker.sock:/var/run/docker.sock",
                "-e", f"ADMIN_EMAIL={email}",
                "-e", f"ADMIN_PASSWORD={password}",
                "cowbox:latest"
            ]
            
            subprocess.run(run_cmd, check=True)
            print("\n✅ Cowbox is successfully running!")
            print(f"Dashboard: http://localhost:9999")
            print(f"Login with: {email} / {password}")
            
        except subprocess.CalledProcessError as e:
            print(f"❌ Failed to start Cowbox: {e}")
            sys.exit(1)

    elif args.command == "stop":
        print("Stopping Cowbox...")
        subprocess.run(["docker", "stop", "cowbox-server"])
        print("✅ Cowbox stopped.")

    elif args.command == "logs":
        subprocess.run(["docker", "logs", "-f", "cowbox-server"])
        
    else:
        parser.print_help()

if __name__ == "__main__":
    main()

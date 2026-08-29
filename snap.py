from playwright.sync_api import sync_playwright
import time
import os

os.makedirs("public/screenshots", exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch()
    context = browser.new_context(viewport={"width": 1280, "height": 800})
    page = context.new_page()
    
    print("Going to login...")
    page.goto("http://localhost:9999/login", timeout=60000)
    
    page.wait_for_selector("input[type='email']", timeout=10000)
    page.fill("input[type='email']", "admin@email.com")
    page.fill("input[type='password']", "password123")
    page.click("button[type='submit']")
    
    print("Waiting for redirect...")
    page.wait_for_selector("text=Dashboard Overview", timeout=15000)
    time.sleep(3) # wait for charts

    print("Taking Dashboard screenshot...")
    page.screenshot(path="public/screenshots/dashboard.png")
    
    print("Taking Master Panel screenshot...")
    page.goto("http://localhost:9999/master")
    time.sleep(3)
    page.screenshot(path="public/screenshots/master.png")
    
    print("Taking Projects screenshot...")
    page.goto("http://localhost:9999/projects")
    time.sleep(3)
    page.screenshot(path="public/screenshots/projects.png")
    
    browser.close()
    print("Done capturing authenticated screenshots!")


from playwright.sync_api import sync_playwright
import os

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Load the index page directly from the file system
        cwd = os.getcwd()
        page.goto(f'file://{cwd}/pages/index.html')

        # Check if the button exists and is visible
        button = page.locator('.gallery-button')
        if button.is_visible():
            print('Button found and visible')
        else:
            print('Button NOT found or not visible')

        # Take a screenshot
        page.screenshot(path='verification/index_page.png')
        browser.close()

if __name__ == '__main__':
    run()

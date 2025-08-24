import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()

        # Listen for all console messages
        page.on("console", lambda msg: print(f"CONSOLE: {msg.type} - {msg.text}"))
        # Listen for page errors
        page.on("pageerror", lambda exc: print(f"PAGE_ERROR: {exc}"))

        # Get the absolute path to the index.html file
        file_path = os.path.abspath('index.html')

        print("Navigating to home page...")
        await page.goto(f'file://{file_path}')
        await page.wait_for_timeout(1000)

        print("Taking screenshot of home page...")
        await page.screenshot(path='jules-scratch/verification/01_home.png')

        print("Navigating to Study page...")
        await page.click('nav a[href="#study"]')
        await page.wait_for_timeout(500)

        print("Clicking on 'Bill\'s Story'...")
        await page.click('a[href="#study/bills-story"]')
        await page.wait_for_timeout(1000) # Wait for content to render

        print("Taking screenshot of Bill's Story...")
        await page.screenshot(path='jules-scratch/verification/02_bills_story.png')

        print("Closing browser...")
        await browser.close()
        print("Browser closed.")

if __name__ == '__main__':
    asyncio.run(main())

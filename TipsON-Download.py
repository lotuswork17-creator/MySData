import os
import time
from datetime import datetime
import pytz
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
import requests

# --- Date folder based on Hong Kong time ---
hk_tz = pytz.timezone('Asia/Hong_Kong')
now_hk = datetime.now(hk_tz)
today = now_hk.strftime("img%y%m%d")   # e.g. img260630

print(f"UTC time    : {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}")
print(f"HK time     : {now_hk.strftime('%Y-%m-%d %H:%M')}")
print(f"Folder name : {today}")

# --- Paths ---
base_folder = "TipsON/images"
output_folder = os.path.join(base_folder, today)   # TipsON/images/img260630
output_txt_file = f"TipsON/{today}.txt"            # TipsON/img260630.txt
webpage_url = "https://football.on.cc/cnt/recommend/tips.html"

os.makedirs(output_folder, exist_ok=True)

# --- Headless Chrome options ---
options = Options()
options.add_argument('--headless')
options.add_argument('--no-sandbox')
options.add_argument('--disable-dev-shm-usage')

def download_images():
    global count_of_download
    count_of_download = 0

    driver = webdriver.Chrome(options=options)
    try:
        print("Opening the browser...")
        driver.get(webpage_url)
        time.sleep(5)   # wait for JavaScript to load images

        main_box = driver.find_element(By.ID, "main_box_form")
        img_elements = main_box.find_elements(By.TAG_NAME, "img")

        with open(output_txt_file, "w", encoding="utf-8") as file:
            for img in img_elements:
                img_src = img.get_attribute("src")
                if img_src and img_src.endswith(".jpg"):
                    img_filename = os.path.basename(img_src)
                    print(f"Downloading {img_src}...")
                    img_response = requests.get(img_src, stream=True)
                    img_response.raise_for_status()

                    img_path = os.path.join(output_folder, img_filename)
                    with open(img_path, "wb") as img_file:
                        for chunk in img_response.iter_content(1024):
                            img_file.write(chunk)

                    count_of_download += 1
                    print(f"Saved: {img_path}")
                    file.write(img_filename + "\n")

        print(f"{count_of_download} images downloaded to {output_folder}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        print("Closing the browser...")
        driver.quit()

download_images()

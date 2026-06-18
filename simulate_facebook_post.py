import os
import requests
import json
import boto3
from botocore.config import Config

FB_PAGE_ID = "846840138502516"
ACCESS_TOKEN = "EAAZAY30EI3M0BRsyBtrZCJ2S5aXPusDl4ebHfQRrZAb2dpK1W7EuPwui1Hrf7QgVaMHXy9oYbAEwBx48jIm8nKjs1OtK5TZAznNOtyaTKHyZB5efom7ihVZAPt42myAjV9ZAw3BZAKWcvzkDv1IValaktSJX1ewWTv2DxnfEYHR7ZAnZACeu6IMkhoNO9GTChrYZAVE42Pw8JZCb"
CAPTION = "Eat faster, Mom. Or don’t eat at all..."
GRAPH_VERSION = "v19.0"

# Object we want to download
OBJECT_KEY = "adu-buffer/e38733ae-cf53-4031-9355-f2a18935bca5/1120711.mp4"
BUCKET_NAME = "fbuploadpro-adu-buffer"

def generate_presigned_url(account_id, access_key, secret_key):
    s3 = boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version="s3v4"),
        region_name="auto"
    )
    
    url = s3.generate_presigned_url(
        ClientMethod="get_object",
        Params={
            "Bucket": BUCKET_NAME,
            "Key": OBJECT_KEY
        },
        ExpiresIn=3600
    )
    return url

def main():
    print("==================================================")
    print("GENERATE R2 PRE-SIGNED URL")
    print("==================================================")
    
    account_id = os.environ.get("R2_ACCOUNT_ID") or input("Enter R2_ACCOUNT_ID: ").strip()
    access_key = os.environ.get("R2_ACCESS_KEY_ID") or input("Enter R2_ACCESS_KEY_ID: ").strip()
    secret_key = os.environ.get("R2_SECRET_ACCESS_KEY") or input("Enter R2_SECRET_ACCESS_KEY: ").strip()
    
    if not account_id or not access_key or not secret_key:
        print("Missing credentials.")
        return
        
    print("\nGenerating pre-signed URL...")
    presigned_url = generate_presigned_url(account_id, access_key, secret_key)
    print(f"Generated URL: {presigned_url}\n")
    
    print("==================================================")
    print("STEP 1: Start Phase (Initialize Video Upload)")
    print("==================================================")
    start_url = f"https://graph.facebook.com/{GRAPH_VERSION}/{FB_PAGE_ID}/video_reels"
    headers = {"Content-Type": "application/json"}
    body = {
        "upload_phase": "start",
        "access_token": ACCESS_TOKEN
    }
    
    print(f"POST {start_url}")
    res = requests.post(start_url, headers=headers, json=body)
    print(f"Status: {res.status_code}")
    print(f"Response: {res.text}")
    
    if res.status_code != 200:
        return
        
    start_data = res.json()
    video_id = start_data.get("video_id")
    upload_url = start_data.get("upload_url", f"https://rupload.facebook.com/video-upload/{GRAPH_VERSION}/{video_id}")
    
    print("\n==================================================")
    print("STEP 2: Upload Phase (Pass Pre-signed URL to rupload)")
    print("==================================================")
    print(f"POST {upload_url}")
    upload_headers = {
        "Authorization": f"OAuth {ACCESS_TOKEN}",
        "file_url": presigned_url
    }
    
    upload_res = requests.post(upload_url, headers=upload_headers)
    print(f"Status: {upload_res.status_code}")
    print(f"Response: {upload_res.text}")
    
    if upload_res.status_code != 200:
        return

    print("\n==================================================")
    print("STEP 3: Finish Phase (Publish Reel)")
    print("==================================================")
    finish_url = f"https://graph.facebook.com/{GRAPH_VERSION}/{FB_PAGE_ID}/video_reels"
    finish_params = {
        "access_token": ACCESS_TOKEN,
        "video_id": video_id,
        "upload_phase": "finish",
        "video_state": "PUBLISHED",
        "description": CAPTION
    }
    print(f"POST {finish_url}")
    finish_res = requests.post(finish_url, params=finish_params)
    print(f"Status: {finish_res.status_code}")
    print(f"Response: {finish_res.text}")

if __name__ == "__main__":
    main()

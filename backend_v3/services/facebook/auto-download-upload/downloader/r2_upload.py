import hashlib
import mimetypes

import boto3
from botocore.config import Config

from config import (
    R2_ACCESS_KEY_ID,
    R2_ACCOUNT_ID,
    R2_BUCKET,
    R2_SECRET_ACCESS_KEY,
)


def get_s3_client():
    if not all([R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY]):
        raise RuntimeError("R2 credentials are required")
    endpoint = f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com"
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def object_key(page_id: str, reel_internal_id: int) -> str:
    return f"adu-buffer/{page_id}/{reel_internal_id}.mp4"


def upload_file(local_path: str, key: str) -> tuple[int, str, str]:
    with open(local_path, "rb") as f:
        data = f.read()
    sha256 = hashlib.sha256(data).hexdigest()
    content_type = mimetypes.guess_type(local_path)[0] or "video/mp4"
    client = get_s3_client()
    client.put_object(
        Bucket=R2_BUCKET,
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    return len(data), content_type, sha256

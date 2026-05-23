import os

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").strip()
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()

R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID", "").strip()
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID", "").strip()
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY", "").strip()
R2_BUCKET = os.environ.get("R2_ADU_BUFFER_BUCKET", "fbuploadpro-adu-buffer").strip()

LOOP_INTERVAL_SECONDS = int(os.environ.get("ADU_DOWNLOADER_LOOP_SECONDS", "120"))
CLAIM_BATCH_SIZE = int(os.environ.get("ADU_DOWNLOADER_CLAIM_BATCH", "10"))
MAX_CONCURRENT = int(os.environ.get("ADU_DOWNLOADER_CONCURRENCY", "3"))
DOWNLOAD_MAX_BYTES = int(os.environ.get("ADU_DOWNLOAD_MAX_BYTES", "209715200"))
RESIDENTIAL_PROXY = os.environ.get("RESIDENTIAL_PROXY", "").strip() or None
IMPERSONATE_TARGET = os.environ.get("IMPERSONATE_TARGET", "").strip() or None

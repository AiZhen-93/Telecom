import json
import re
import urllib.request
from pathlib import Path


DATA_FILE = Path("hsr-project-data.js")
PIC_DIR = Path("pic")

text = DATA_FILE.read_text(encoding="utf-8")
data = json.loads(re.search(r"window\.hsrProjectData = (.*);\s*$", text, re.S).group(1))

PIC_DIR.mkdir(exist_ok=True)
downloaded = 0
skipped = 0
failed = []

for item in data["items"]:
    video_id = item["videoId"]
    target = PIC_DIR / f"HSR_{video_id}.jpg"
    if target.exists() and target.stat().st_size > 0:
        skipped += 1
        continue
    url = f"https://i.ytimg.com/vi/{video_id}/hqdefault.jpg"
    try:
        request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(request, timeout=20) as response:
            target.write_bytes(response.read())
        downloaded += 1
    except Exception as exc:
        failed.append({"videoId": video_id, "error": str(exc)})

print(json.dumps({"downloaded": downloaded, "skipped": skipped, "failed": failed}, ensure_ascii=False, indent=2))

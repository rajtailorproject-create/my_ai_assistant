"""Create password-encrypted Excel workbooks, one per year, from owner activity records."""
import io
import os
from collections import defaultdict
from datetime import datetime
from pathlib import Path

import msoffcrypto
import requests
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill

password = os.environ['EXCEL_PASSWORD']
if len(password) < 16:
    raise ValueError('EXCEL_PASSWORD must have at least 16 characters')
url = os.environ['SUPABASE_URL'].rstrip('/') + '/rest/v1/activities'
key = os.environ['SUPABASE_SERVICE_ROLE_KEY']
owner = os.environ['OWNER_USER_ID']
headers = {'apikey': key, 'Authorization': 'Bearer ' + key}
rows = []
offset = 0
while True:
    r = requests.get(url, headers=headers, params={
        'select': 'id,activity_name,activity_date,minutes,created_at',
        'user_id': 'eq.' + owner,
        'order': 'activity_date.asc,created_at.asc,id.asc',
        'limit': 1000,
        'offset': offset,
    }, timeout=30)
    r.raise_for_status()
    batch = r.json()
    rows.extend(batch)
    if len(batch) < 1000:
        break
    offset += 1000

by_year = defaultdict(list)
for record in rows:
    year = int(record['activity_date'][:4])
    if year < 2000 or year > 2100:
        raise ValueError('Invalid activity year')
    by_year[year].append(record)
folder = Path('data')
folder.mkdir(exist_ok=True)
for year, records in sorted(by_year.items()):
    book = Workbook()
    sheet = book.active
    sheet.title = 'Activities'
    sheet.append(['Date', 'Activity', 'Minutes', 'Entry ID', 'Saved at (UTC)'])
    for record in records:
        day = datetime.strptime(record['activity_date'], '%Y-%m-%d')
        sheet.append([day, record['activity_name'], record['minutes'], record['id'], record['created_at']])
        sheet.cell(sheet.max_row, 1).number_format = 'yyyy-mm-dd'
    for cell in sheet[1]:
        cell.font = Font(bold=True, color='FFFFFF')
        cell.fill = PatternFill(fill_type='solid', fgColor='245B9A')
    sheet.freeze_panes = 'A2'
    sheet.auto_filter.ref = sheet.dimensions
    for col, width in [('A', 15), ('B', 18), ('C', 12), ('D', 40), ('E', 29)]:
        sheet.column_dimensions[col].width = width
    plain = io.BytesIO()
    book.save(plain)
    plain.seek(0)
    encrypted = io.BytesIO()
    msoffcrypto.OfficeFile(plain).encrypt(password, encrypted)
    data = encrypted.getvalue()
    if not data.startswith(bytes.fromhex('D0CF11E0A1B11AE1')):
        raise RuntimeError('Excel encryption failed')
    (folder / f'{year}.xlsx').write_bytes(data)
    print(f'Encrypted data/{year}.xlsx: {len(records)} records')
print(f'Synchronized {len(rows)} activity records across {len(by_year)} workbooks')

import pandas as pd
import json
import os

xl = pd.ExcelFile('禁烟条例.xlsx')

# Read main sheet
df = pd.read_excel(xl, sheet_name='控烟相关法规')
df = df.drop(columns=['Unnamed: 15'], errors='ignore')

# Read other regulations sheet
df_other = pd.read_excel(xl, sheet_name='其他法规')
df_other = df_other.drop(columns=[' '], errors='ignore')

# Convert to JSON-friendly format
def df_to_json(df):
    df = df.replace({pd.NA: None, float('nan'): None})
    return json.loads(df.to_json(orient='records', force_ascii=False))

main_data = df_to_json(df)
other_data = df_to_json(df_other)

# Create data directory
os.makedirs('data', exist_ok=True)

# Save to JSON files
with open('data/main.json', 'w', encoding='utf-8') as f:
    json.dump(main_data, f, ensure_ascii=False, indent=2)

with open('data/other.json', 'w', encoding='utf-8') as f:
    json.dump(other_data, f, ensure_ascii=False, indent=2)

print(f'Main data: {len(main_data)} records')
print(f'Other data: {len(other_data)} records')

# Get unique regions by level
regions = {'国家级': [], '省级': [], '地级': [], '县级': []}
for row in main_data:
    level = row.get('级别')
    if level in regions:
        region = row.get('地区')
        if region and region not in regions[level]:
            regions[level].append(region)

with open('data/regions.json', 'w', encoding='utf-8') as f:
    json.dump(regions, f, ensure_ascii=False, indent=2)

print('Regions saved')
for level, regs in regions.items():
    print(f'{level}: {len(regs)} regions')
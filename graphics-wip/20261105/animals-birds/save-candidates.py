from pathlib import Path
import shutil,json
base=Path(r'C:\Users\Тема\.codex\generated_images\01a1a8f6-4b73-7b92-a8ec-4e023e0ca3af')
dest=Path(__file__).parent/'candidates'
files={
 'crow-flight-v1':'8d66c825-c91f-4d7c-bfcf-f2263e9fe28c',
 'fRaven-flight-v1':'db95d4d2-525b-4896-9e35-24da146c2a7e',
 'stork-flight-v1':'333c8e08-6c87-4e77-b58d-84db308b6855',
 'heron-flight-v1':'109294ee-a624-4ec4-8f71-c914c5ff297b',
 'bat-flight-v1':'2442b72b-c37b-40ae-bc3d-6d3254fd4617',
 'crow-ground-v1':'521a88fd-ac34-4d33-a936-db04a9042e14',
 'stork-ground-v1':'958f8e11-3b34-4fb0-8422-638803f6d3f9',
 'heron-ground-v1':'056eea86-a172-439a-94aa-364126aa0eb6',
 'pheasant-ground-v1':'46c133d2-6eea-4198-81b5-b8970a5890d1',
 'pichugi-ground-v1':'bff0cc0b-ac11-4d1c-8d86-b1b1674fb464',
 'pichugi-flight-v1':'473f9b4a-7650-47cd-bde2-0633481d810c',
 'pichugiWinter-ground-v1':'16fbddf0-5f5d-47d8-af10-6571c7e3b9b1',
 'pichugiWinter-flight-v1':'5e6f5d51-8772-478b-b9e9-c9f596084b4a',
 'gull-flight-v1':'ed3a9b71-ae6a-4c57-a0cc-668b1524bb03',
 'gull-idle-v1':'23eac7b7-d746-475d-86c9-1ad7983b12ac',
 'corm-flight-v1':'2962584d-ef7a-4751-a9c6-47f9337ac80f',
 'corm-idle-v1':'76a82480-18a9-495a-afae-8852147f3382',
 'owl-flight-v3':'390ef4df-05c1-4236-b498-91fa3fc565cc'
}
for name,uid in files.items():shutil.copy2(base/f'exec-{uid}.png',dest/f'{name}.png')
(dest/'pending-registry.json').write_text(json.dumps({'status':'raw generated assets; NOT runtime-ready and NOT proof of native-state coverage','files':files},indent=2),encoding='utf-8')
print(f'Saved {len(files)} generated source atlases')

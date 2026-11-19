from pathlib import Path
import base64,json,shutil
root=Path(__file__).resolve().parent.parent
out=root/'dist'
if out.exists(): shutil.rmtree(out)
(out/'server').mkdir(parents=True)
(out/'.openai').mkdir()
assets={}
types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'}
for p in (root/'web').iterdir():
 if p.suffix not in types:continue
 binary=p.suffix in ['.png','.webp','.jpg']
 assets['/'+p.name]={'type':types[p.suffix],'body':base64.b64encode(p.read_bytes()).decode() if binary else p.read_text(),'base64':binary}
config=(root/'worker/config.mjs').read_text().replace('export function validateConfig','function validateConfig').replace('export function upgradeConfig','function upgradeConfig')
operations=(root/'worker/operations.mjs').read_text().replace('export const ','const ').replace('export function ','function ').replace('export async function ','async function ')
runtime=(root/'worker/runtime.mjs').read_text().replace("import { validateConfig, upgradeConfig } from './config.mjs';",'').replace("import { handleOperations } from './operations.mjs';",'').replace('export function createWorker','function createWorker')
source=config+'\n'+operations+'\n'+runtime+'\nconst assets='+json.dumps(assets)+';\nconst defaults='+(root/'worker/defaults.json').read_text()+';\nexport default createWorker(assets,defaults);\n'
(out/'server/index.js').write_text(source)
shutil.copyfile(root/'.openai/hosting.json',out/'.openai/hosting.json')
print('Built Worker with embedded storefront and admin assets.')

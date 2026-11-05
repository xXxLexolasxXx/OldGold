from pathlib import Path
p=Path(__file__).with_name('inspect.cjs')
s=p.read_text(encoding='utf-8')
mark="fs.writeFileSync(path.join(__dirname,'native-roster.json')"
s=s.replace(mark,"if(result.out.nativeContactSheet){fs.writeFileSync(path.join(__dirname,'native-all.png'),Buffer.from(result.out.nativeContactSheet.split(',')[1],'base64'));delete result.out.nativeContactSheet;}"+mark)
p.write_text(s,encoding='utf-8')

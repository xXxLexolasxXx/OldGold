from pathlib import Path
root=Path(__file__).parent
for name in ['inspect.cjs','qa.cjs','qa-animation.cjs','qa-contract.cjs','compile-current.cjs']:
 p=root/name;s=p.read_text(encoding='utf-8')
 s=s.replace("}finally{await browser.close();await srv.close();process.exit(0)}})","}catch(e){console.error(e);process.exitCode=1;}finally{await browser.close();srv.close();process.exit(process.exitCode||0)}})")
 if name=='qa-contract.cjs':
  s=s.replace('**/assets/fantasy-birds/owl-flight-v2.png','**/assets/fantasy-birds/owl-flight-runtime-v2.png')
  s=s.replace("results.push({device,...r,pageErrors:errors});","if(errors.length||device==='missing-asset'?(device==='missing-asset'&&(r.ready||!r.errors.length||!r.fallback)):(!r.ready||r.errors.length||r.directions.some(d=>!d.match||d.mutation)||r.cache.entries>16))throw Error('Contract failure: '+device+JSON.stringify(r));results.push({device,...r,pageErrors:errors});")
 if name=='qa.cjs':s=s.replace('console.log(result,errors);',"console.log(result,errors);if(!result.stable||result.mutation||result.errors.length||errors.length)throw Error('Owl QA failed');")
 if name=='qa-animation.cjs':s=s.replace('console.log(result,pageErrors);',"console.log(result,pageErrors);if(result.mutation||result.boundary.length||pageErrors.length)throw Error('Native animation QA failed');")
 p.write_text(s,encoding='utf-8')

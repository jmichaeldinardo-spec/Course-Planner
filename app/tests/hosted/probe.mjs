// Unauthenticated deployment preflight. Never reported as hosted acceptance.
import {options,secureDirectory,privateDir,privateWrite,launch,guard,verifySource} from './runtime.mjs';
import {resolve} from 'node:path';
let browser;const result={kind:'unauthenticated-deployment-preflight',authenticatedAcceptance:false,status:'BLOCKED'};
try{
 const opts=options();result.target=opts;await secureDirectory();browser=await launch();const context=await browser.newContext({serviceWorkers:'block'});await guard(context,opts);
 result.sourceFilesChecked=await verifySource(context,opts);result.status='PASS';
}catch(e){result.reason=['DEPLOYMENT_ACCESS_BLOCKED','DEPLOYMENT_SOURCE_MISMATCH'].includes(e.message)?e.message:'PREFLIGHT_UNAVAILABLE';}
finally{await browser?.close();await privateWrite(resolve(privateDir,'preflight.json'),result);console.log(JSON.stringify(result));process.exitCode=result.status==='PASS'?0:2;}

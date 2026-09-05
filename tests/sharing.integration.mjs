import assert from 'node:assert/strict';
const base=process.env.TEST_ORIGIN||'http://localhost:8787';
const run=Date.now().toString(36),A='test_owner_a_'+run,B='test_owner_b_'+run;
const headers=owner=>owner?{'oai-authenticated-user-id':owner,'oai-authenticated-user-email':owner+'@example.test'}:{};
async function request(path,owner,method='GET',body,origin=base){const response=await fetch(base+path,{method,signal:AbortSignal.timeout(20000),redirect:'manual',headers:{...headers(owner),...(method!=='GET'?{'content-type':'application/json',origin}:{} )},...(body!==undefined?{body:JSON.stringify(body)}:{})});const bytes=await response.arrayBuffer();return new Response(bytes,{status:response.status,headers:response.headers});}
async function data(response,status=200){const body=await response.json();assert.equal(response.status,status,JSON.stringify(body));return body;}
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6VZAAAAAASUVORK5CYII=';
const record=(id,name)=>({id,name,community:'Test',kind:'Custom',favorite:true,state:'Living',species:'Tyrannosaurus',growth:83,code:'SKIN_PRIVATE_BY_DEFAULT',photo:''});
assert.equal((await request('/',null)).status,307,'Editor must redirect anonymous viewer');
assert.equal((await request('/api/garage',null)).status,401);
assert.equal((await request('/api/shares',null)).status,401);
assert.equal((await request('/api/garage',A,'PUT',{version:0,records:[]},'https://other.example')).status,403);
const publicRecord={...record('public','Shared test server'),photo:png};
const privateRecord=record('private','DO_NOT_EXPOSE_PRIVATE_SERVER');
let a=await data(await request('/api/garage',A,'PUT',{version:0,records:[publicRecord,privateRecord]}));
assert.equal(a.version,1);assert.ok(a.records[0].photo.startsWith('/api/photos/'));
const b=await data(await request('/api/garage',B,'PUT',{version:0,records:[record('b','Owner B only')]}));
assert.equal(b.records[0].name,'Owner B only');
assert.equal((await data(await request('/api/garage',A))).records.length,2);
const created=await data(await request('/api/shares',A,'POST',{title:'Acceptance garage',selectedIds:['public'],includeCodes:false,includePhotos:false}),201);const id=created.id;
assert.match(id,/^[a-f0-9]{32}$/);
assert.equal((await request('/api/shares/'+id,B,'PATCH',{title:'Hijack',selectedIds:['b'],includeCodes:true,includePhotos:true})).status,404);
assert.equal((await request('/api/shares/'+id,B,'DELETE',{})).status,404);
let shared=await data(await request('/api/shared/'+id,null));assert.equal(shared.records.length,1);assert.equal(shared.records[0].growth,83);assert.equal(shared.records[0].code,undefined);assert.equal(shared.records[0].photo,undefined);assert.ok(!JSON.stringify(shared).includes(A));assert.ok(!JSON.stringify(shared).includes('DO_NOT_EXPOSE'));
const page=await request('/s/'+id,null);assert.equal(page.status,200);const html=await page.text();assert.match(html,/og:image/);assert.match(html,/Acceptance garage/);assert.ok(!html.includes('DO_NOT_EXPOSE'));assert.ok(!html.includes('SKIN_PRIVATE_BY_DEFAULT'));assert.ok(!html.includes(A));
const imageResponse=await request('/s/'+id+'/image',null);assert.equal(imageResponse.status,200);assert.match(imageResponse.headers.get('content-type'),/image\/png/);const image1=Buffer.from(await imageResponse.arrayBuffer());assert.equal(image1.subarray(1,4).toString(),'PNG');
assert.equal((await request(a.records[0].photo,null)).status,401);assert.equal((await request(a.records[0].photo,B)).status,404);assert.equal((await request(a.records[0].photo,A)).status,200);
a=await data(await request('/api/garage',A,'PUT',{version:1,records:a.records.map(r=>r.id==='public'?{...r,growth:94}:r)}));
shared=await data(await request('/api/shared/'+id,null));assert.equal(shared.records[0].growth,94);assert.ok(shared.records[0].updatedAt);const image2=Buffer.from(await (await request('/s/'+id+'/image',null)).arrayBuffer());assert.notDeepEqual(image1,image2,'Same link image must reflect edit');
assert.equal((await request('/api/garage',A,'PUT',{version:0,records:[]})).status,409);
assert.equal((await request('/api/garage',A,'PUT',{version:2,records:[{...record('url','URL'),photo:'https://private.example/secret'}]})).status,400);
await data(await request('/api/shares/'+id,A,'PATCH',{title:'Explicit fields',selectedIds:['public'],includeCodes:true,includePhotos:true}));shared=await data(await request('/api/shared/'+id,null));assert.equal(shared.records[0].code,'SKIN_PRIVATE_BY_DEFAULT');assert.ok(shared.records[0].photo);assert.equal((await request(shared.records[0].photo,null)).status,200);assert.equal((await request('/s/'+id+'/photo/private',null)).status,404);
const photoImage=await request('/s/'+id+'/image',null);assert.equal(photoImage.status,200);assert.match(photoImage.headers.get('content-type'),/image\/png/);
assert.equal((await data(await request('/api/discord',A))).configured,false);assert.equal((await data(await request('/api/discord',A,'POST',{}))).status,'not_configured');
await data(await request('/api/shares/'+id,A,'DELETE',{}));assert.equal((await request('/api/shared/'+id,null)).status,404);assert.equal((await request('/s/'+id,null)).status,404);assert.equal((await request('/s/'+id+'/image',null)).status,404);assert.equal((await request(shared.records[0].photo,null)).status,404);
console.log('PASS: anonymous editor/API denial; two-owner isolation; same-origin mutations; selected fields only; PNG metadata/image; same-link live edit; screenshot isolation/opt-in; stale-write rejection; arbitrary URL rejection; revocation page/API/image; disabled Discord.');


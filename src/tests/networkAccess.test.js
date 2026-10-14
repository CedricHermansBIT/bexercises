const test=require('node:test');
const assert=require('node:assert/strict');
const net=require('node:net');
const fs=require('node:fs/promises');
const {validateNetworkHosts}=require('../services/networkPolicy');
const {createNetworkGateway,isPublicAddress,readClientHelloSNI}=require('../services/networkGateway');

function helloFor(host) {
 const name=Buffer.from(host);
 const sni=Buffer.alloc(9+name.length);sni.writeUInt16BE(0,0);sni.writeUInt16BE(5+name.length,2);
 sni.writeUInt16BE(3+name.length,4);sni[6]=0;sni.writeUInt16BE(name.length,7);name.copy(sni,9);
 const body=Buffer.concat([Buffer.from([3,3]),Buffer.alloc(32),Buffer.from([0,0,2,0x13,1,1,0]),Buffer.from([sni.length>>8,sni.length&255]),sni]);
 const handshake=Buffer.concat([Buffer.from([1,body.length>>16,(body.length>>8)&255,body.length&255]),body]);
 return Buffer.concat([Buffer.from([22,3,1,handshake.length>>8,handshake.length&255]),handshake]);
}
function proxyRequest(socketPath,request) {
 return new Promise((resolve,reject)=>{
  const socket=net.connect(socketPath);let response='';
  socket.setTimeout(3000,()=>{socket.destroy();reject(new Error('test timeout'))});
  socket.on('connect',()=>socket.write(request));socket.on('data',chunk=>response+=chunk);
  socket.on('error',reject);socket.on('end',()=>resolve(response));
 });
}
test('network authoring only permits approved exact hosts and public addresses',()=>{
 assert.deepEqual(validateNetworkHosts(['www.ebi.ac.uk']),['www.ebi.ac.uk']);
 for(const hosts of [['*.ebi.ac.uk'],['example.com'],['127.0.0.1'],['www.ebi.ac.uk:443'],['www.ebi.ac.uk','www.ebi.ac.uk'],{}]) assert.throws(()=>validateNetworkHosts(hosts));
 assert.throws(()=>validateNetworkHosts(['www.ebi.ac.uk'],'bash'),/only for Python/);
 for(const ip of ['127.0.0.1','10.1.2.3','172.16.1.1','192.168.1.1','169.254.169.254','100.64.0.1','198.18.0.1','224.0.0.1','0.0.0.0','::1','::ffff:127.0.0.1','fc00::1','fe80::1','2001:db8::1','2002:7f00:1::']) assert.equal(isPublicAddress(ip),false,ip);
 for(const ip of ['1.1.1.1','8.8.8.8','2606:4700:4700::1111']) assert.equal(isPublicAddress(ip),true,ip);
 const hello=helloFor('www.ebi.ac.uk');
 assert.equal(readClientHelloSNI(hello),'www.ebi.ac.uk');
 assert.equal(readClientHelloSNI(hello.subarray(0,20)),null);
 assert.throws(()=>readClientHelloSNI(Buffer.from('GET / HTTP/1.1\r\n')),/TLS/);
});

test('host gateway blocks unauthorized hosts, ports and DNS rebinding, then cleans its socket',async()=>{
 let lookups=0,connections=0;
 const gateway=await createNetworkGateway(['www.ebi.ac.uk'],{lookup:async()=>{lookups++;return [{address:'127.0.0.1',family:4}]},connect:()=>{connections++;throw new Error('Must not connect')}});
 assert.equal(require('node:path').dirname(gateway.directory),require('../config').paths.temp,
  'Proxy mounts must use the engine-visible workspace root, not systemd PrivateTmp');
 try{
  for(const request of ['CONNECT example.com:443 HTTP/1.1\r\nHost: example.com\r\n\r\n','CONNECT www.ebi.ac.uk:80 HTTP/1.1\r\nHost: www.ebi.ac.uk\r\n\r\n','GET http://www.ebi.ac.uk/ HTTP/1.1\r\nHost: www.ebi.ac.uk\r\n\r\n','CONNECT www.ebi.ac.uk:443 HTTP/1.1\r\nHost: www.ebi.ac.uk\r\n\r\n']) {
   assert.match(await proxyRequest(gateway.socketPath,request),/403/);
  }
  assert.equal(lookups,1);assert.equal(connections,0);
  assert.ok(gateway.feedback().failures.some(message=>message.includes('private')));
 }finally{await gateway.close()}
 await assert.rejects(fs.stat(gateway.directory),{code:'ENOENT'});
});

test('gateway pins the checked IP and rejects a different TLS hostname on shared infrastructure',async()=>{
 const fake=net.createServer(socket=>socket.on('data',()=>{}));
 await new Promise(resolve=>fake.listen(0,'127.0.0.1',resolve));
 let destination;
 const gateway=await createNetworkGateway(['www.ebi.ac.uk'],{
 lookup:async()=>[{address:'8.8.8.8',family:4}],
 connect:options=>{destination=options;return net.connect({port:fake.address().port,host:'127.0.0.1'})}
 });
 try{
  await new Promise((resolve,reject)=>{
   const socket=net.connect(gateway.socketPath);socket.setTimeout(3000,()=>reject(new Error('timeout')));
   socket.on('connect',()=>socket.write('CONNECT www.ebi.ac.uk:443 HTTP/1.1\r\nHost: www.ebi.ac.uk\r\n\r\n'));
   socket.once('data',chunk=>{assert.match(String(chunk),/200 Connection/);socket.write(helloFor('example.com'))});
   socket.on('error',()=>{});socket.on('close',resolve);
  });
  assert.deepEqual(destination,{host:'8.8.8.8',port:443,family:4});
  assert.ok(gateway.feedback().failures.some(message=>message.includes('TLS hostname')));
 }finally{await gateway.close();await new Promise(resolve=>fake.close(resolve));}
});

test('network metadata round-trips and legacy cases remain offline',async()=>{
 const sqlite3=require('sqlite3');const {open}=require('sqlite');
 const service=new (require('../services/databaseService').constructor)();
 service.db=await open({filename:':memory:',driver:sqlite3.Database});
 try{
  await service.createTables();await service.createLanguage({id:'python',name:'Python'});
  await service.createLanguage({id:'bash',name:'Bash'});
  await service.createChapter({id:'web',language_id:'python',name:'Web'});
  await service.createChapter({id:'bash-chapter',language_id:'bash',name:'Bash'});
  await service.createExercise({id:'network-draft',chapter_id:'web',title:'Web',testCases:[{networkHosts:['www.ebi.ac.uk']},{expectedOutput:'offline'}]});
  let saved=await service.getExerciseWithTests('network-draft');
  assert.deepEqual(saved.testCases[0].networkHosts,['www.ebi.ac.uk']);assert.deepEqual(saved.testCases[1].networkHosts,[]);
  await assert.rejects(service.updateExercise('network-draft',{chapter_id:'bash-chapter'}),/only for Python/);
  await service.createTables();saved=await service.getExerciseWithTests('network-draft');
  assert.equal(saved.chapter_id,'web');
 }finally{service.cache.clear();await service.db.close();}
});

test('real restricted container reaches an approved website and cannot bypass the proxy',{
 skip:process.env.RUN_NETWORK_TESTS!=='1'?'Set RUN_NETWORK_TESTS=1 for live public HTTPS check':false
},async()=>{
 const {runTests}=require('../services/testRunner');
 const script=`
import urllib.request, urllib.error, json, socket, ssl
with urllib.request.urlopen('https://www.ebi.ac.uk/interpro/api/entry/pfam/PF00001/',timeout=10) as response:
 data=json.load(response)
 assert data['metadata']['accession']=='PF00001'
try:
 urllib.request.urlopen('https://example.com/',timeout=5)
 raise AssertionError('Unapproved host was reachable')
except urllib.error.URLError:
 pass
try:
 socket.create_connection(('1.1.1.1',443),timeout=1)
 raise AssertionError('Direct network was reachable')
except OSError:
 pass
print('restricted web OK')
`;
 let result=(await runTests({id:'network-unsaved',language_id:'python',testCases:[{networkHosts:['www.ebi.ac.uk'],expectedOutput:'restricted web OK'}]},script))[0];
 assert.equal(result.passed,true,JSON.stringify(result));
 assert.ok(result.network.failures.some(message=>message.includes('not allowed')));
 result=(await runTests({id:'network-unsaved',language_id:'python',testCases:[{expectedOutput:'blocked'}]},`
import urllib.request,urllib.error
try:
 urllib.request.urlopen('https://www.ebi.ac.uk/',timeout=2)
 print('unexpected')
except urllib.error.URLError:
 print('blocked')
`))[0];
 assert.equal(result.passed,true,JSON.stringify(result));
});

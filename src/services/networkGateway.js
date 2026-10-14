const http = require('node:http');
const net = require('node:net');
const dns = require('node:dns/promises');
const fs = require('node:fs/promises');
const path = require('node:path');
const {createTempDirectory} = require('../utils/tempDirectory');
const {validateNetworkHosts} = require('./networkPolicy');

const privateAddresses = new net.BlockList();
for (const [address, prefix] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],
 ['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.88.99.0',24],
 ['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',3]]) privateAddresses.addSubnet(address,prefix,'ipv4');
for (const [address, prefix] of [['2001::',23],['2001:db8::',32],['2002::',16],['3fff::',20]]) privateAddresses.addSubnet(address,prefix,'ipv6');
function isPublicAddress(address) {
 const family=net.isIP(address);
 return family === 4 ? !privateAddresses.check(address,'ipv4')
  : family === 6 && /^[23]/i.test(address) && !privateAddresses.check(address,'ipv6');
}

// Return null until a complete TLS ClientHello arrives. Inspect SNI before relaying
// anything, preventing CONNECT to an allowed shared CDN address with another SNI.
function readClientHelloSNI(buffer) {
 if (buffer.length > 65536) throw new Error('TLS hello exceeds limit');
 let offset=0, payload=Buffer.alloc(0);
 while (offset+5 <= buffer.length) {
  if (buffer[offset] !== 22 || buffer[offset+1] !== 3) throw new Error('HTTPS requires a TLS ClientHello');
  const size=buffer.readUInt16BE(offset+3);
  if (size > 16384) throw new Error('TLS record exceeds limit');
  if (offset+5+size > buffer.length) return null;
  payload=Buffer.concat([payload,buffer.subarray(offset+5,offset+5+size)]);offset+=5+size;
  if (payload.length < 4) continue;
  if (payload[0] !== 1) throw new Error('HTTPS requires a TLS ClientHello');
  const length=payload.readUIntBE(1,3);
  if(length > 60000) throw new Error('TLS hello exceeds limit');
  if(payload.length < 4+length) continue;
  const hello=payload.subarray(4,4+length);
  let cursor=34;
  const need=length=>{if(cursor+length > hello.length) throw new Error('Malformed TLS hello');};
  need(1);const sessionSize=hello[cursor++];need(sessionSize);cursor+=sessionSize;
  need(2);const cipherSize=hello.readUInt16BE(cursor);cursor+=2;need(cipherSize);cursor+=cipherSize;
  need(1);const compressionSize=hello[cursor++];need(compressionSize);cursor+=compressionSize;
  need(2);const extensionSize=hello.readUInt16BE(cursor);cursor+=2;need(extensionSize);
  const end=cursor+extensionSize;
  while(cursor+4 <= end) {
   const type=hello.readUInt16BE(cursor), size=hello.readUInt16BE(cursor+2);cursor+=4;
   if(cursor+size > end) throw new Error('Malformed TLS extension');
   if(type===0) {
    if(size < 5 || hello.readUInt16BE(cursor)!==size-2) throw new Error('Malformed TLS hostname');
    const nameType=hello[cursor+2], nameSize=hello.readUInt16BE(cursor+3);
    const hostname=hello.subarray(cursor+5,cursor+5+nameSize);
    if(nameType!==0 || nameSize!==size-5 || [...hostname].some(byte=>byte>127)) throw new Error('Malformed TLS hostname');
    return hostname.toString('ascii').toLowerCase();
   }
   cursor+=size;
  }
  throw new Error('HTTPS requires the approved TLS hostname');
 }
 return null;
}

// Separate from the runner module: students never receive a host network interface.
// HTTPS is an end-to-end TLS tunnel; the host pins DNS before making the connection.
async function createNetworkGateway(hosts, overrides = {}) {
 validateNetworkHosts(hosts);
 const lookup=overrides.lookup || dns.lookup;
 const connect=overrides.connect || net.connect;
 // systemd PrivateTmp hides /tmp from the container engine's mount namespace.
 // Use the same configured, engine-visible root as script workspaces.
 const directory=await createTempDirectory('bitlab-network-');
 await fs.chmod(directory,0o755);
 await fs.copyFile(path.join(__dirname,'../runners/networkForwarder.py'),path.join(directory,'forwarder.py'));
 await fs.chmod(path.join(directory,'forwarder.py'),0o644);
 const sockets=new Set();
 const failures=[];
 let attempts=0, bytes=0, closed=false;
 const deadline=Date.now() + (overrides.timeoutMs || 30000);
 const server=http.createServer({maxHeaderSize:8192}, (req,res)=>{
  req.resume();
  failures.push('Only HTTPS on port 443 is supported');
  res.writeHead(403,{'Connection':'close'});res.end('BITLab network policy: use an approved HTTPS URL');
 });
 server.maxConnections=4;
 server.requestTimeout=5000;server.headersTimeout=5000;
 server.on('connection',socket=>{
  sockets.add(socket);socket.on('close',()=>sockets.delete(socket));
  socket.setTimeout(10000,()=>socket.destroy());
  socket.on('error',()=>{});
 });
 server.on('clientError',(_error,socket)=>socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'));
 server.on('connect',async(req,client,head)=>{
  const reject=message=>{
   failures.push(message);
   if (!client.destroyed) client.end(`HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Type: text/plain\r\n\r\nBITLab network policy: ${message}`);
  };
  try {
   const match=/^([a-z0-9.-]+):443$/i.exec(req.url || '');
   const host=match?.[1].toLowerCase();
   if (!host || !hosts.includes(host)) return reject('Host or port is not allowed for this test');
   if (++attempts > 12 || Date.now() >= deadline) return reject('Network request/time limit exceeded');
   let timer;
   const addresses=await Promise.race([
    lookup(host,{all:true,verbatim:true}),
    new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('DNS timeout')),3000);})
   ]).finally(()=>clearTimeout(timer));
   if (!addresses.length || addresses.some(item=>!isPublicAddress(item.address))) return reject('Destination resolved to a private or reserved address');
   if (closed || client.destroyed) return;
   // Pin the verified address, preventing a second DNS lookup / rebinding.
   const address=addresses.find(item=>item.family===4) || addresses[0];
   const upstream=connect({host:address.address,port:443,family:address.family});
   sockets.add(upstream);upstream.on('close',()=>sockets.delete(upstream));
   const stop=()=>{client.destroy();upstream.destroy();};
   upstream.setTimeout(10000,()=>{failures.push('Upstream connection timeout');stop();});
   const connectionTimer=setTimeout(()=>{failures.push('Upstream connection timeout');stop();},5000);
   upstream.on('error',()=>{clearTimeout(connectionTimer);failures.push('Approved website connection failed');stop();});
   client.on('close',()=>upstream.destroy());
   upstream.on('close',()=>client.destroy());
   let uploaded=0;
   const count=(chunk,upload)=>{
    bytes+=chunk.length;if(upload) uploaded+=chunk.length;
    if (bytes > 4*1024*1024 || uploaded > 128*1024 || Date.now() >= deadline) {
     failures.push('Network transfer limit exceeded');stop();
    }
   };
   upstream.once('connect',()=>{
    clearTimeout(connectionTimer);
    if (client.destroyed || closed) return stop();
    client.write('HTTP/1.1 200 Connection Established\r\n\r\n');
    let pending=Buffer.alloc(0);
    const hello=chunk=>{
     count(chunk,true);
     if(client.destroyed) return;
     try {
      pending=Buffer.concat([pending,chunk]);
      const sni=readClientHelloSNI(pending);
      if(sni===null) return;
      if(sni!==host) throw new Error('TLS hostname must match the approved website');
      client.removeListener('data',hello);
      upstream.write(pending);
      client.on('data',chunk=>count(chunk,true));upstream.on('data',chunk=>count(chunk,false));
      client.pipe(upstream);upstream.pipe(client);
     } catch(error) {failures.push(error.message);stop();}
    };
    client.on('data',hello);
    if(head.length) hello(head);
   });
  } catch(error) {reject(error.message === 'DNS timeout' ? error.message : 'Approved website DNS lookup failed');}
 });
 try {
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(path.join(directory,'proxy.sock'),resolve);});
  await fs.chmod(path.join(directory,'proxy.sock'),0o666);
 } catch(error) {server.close();await fs.rm(directory,{recursive:true,force:true});throw error;}
 return {directory, socketPath:path.join(directory,'proxy.sock'), hosts,
  feedback:()=>({hosts,connections:attempts,bytes,failures:[...new Set(failures)].slice(0,10)}),
  async close(){closed=true;for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));await fs.rm(directory,{recursive:true,force:true});}
 };
}
module.exports={createNetworkGateway,isPublicAddress,readClientHelloSNI};

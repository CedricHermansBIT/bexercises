function validateStarterCode(value) {
 if(value === undefined || value === null) return;
 if(typeof value !== 'string') throw new Error('Starter code must be text or null');
 if(Buffer.byteLength(value, 'utf8') > 65536) throw new Error('Starter code exceeds 64 KiB');
}

function extractDescriptionStarter(description) {
 const pattern = /(^|\n)#{1,6}[ \t]+Starter code[ \t]*\r?\n[ \t]*```[^\r\n]*\r?\n([\s\S]*?)\r?\n[ \t]*```[ \t]*(?=\r?\n|$)/i;
 const match = pattern.exec(description || '');
 if(!match) return null;
 const starter_code = match[2].replace(/\r\n/g, '\n') + '\n';
 validateStarterCode(starter_code);
 return {starter_code, description:description.replace(pattern,
  '$1')};
}
module.exports = {validateStarterCode, extractDescriptionStarter};

// Exact hosts used by the web-interaction teaching unit. No wildcard subdomains.
const COURSE_NETWORK_HOSTS = Object.freeze([
 'www.ncbi.nlm.nih.gov', 'eutils.ncbi.nlm.nih.gov',
 'www.ebi.ac.uk', 'rest.kegg.jp', 'www.kegg.jp', 'www.genome.jp'
]);
function approvedNetworkHosts() {
 return [...new Set([...COURSE_NETWORK_HOSTS, ...(process.env.BITLAB_NETWORK_HOSTS || '').split(',').map(host => host.trim().toLowerCase()).filter(Boolean)])];
}
function validateNetworkHosts(hosts = [], languageId = 'python') {
 if (!Array.isArray(hosts) || hosts.length > 8 || new Set(hosts).size !== hosts.length
  || hosts.some(host => typeof host !== 'string' || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}$/.test(host)
   || !approvedNetworkHosts().includes(host))) {
  throw new Error('Network access needs up to eight distinct, approved exact hostnames');
 }
 if (hosts.length && languageId !== 'python') throw new Error('Restricted web access is currently supported only for Python');
 return hosts;
}
module.exports = {COURSE_NETWORK_HOSTS, approvedNetworkHosts, validateNetworkHosts};

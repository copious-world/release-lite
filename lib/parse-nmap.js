




function nmap_parser(txt) {
    let lines = txt.split('\n')
    lines = lines.filter(line => line.indexOf('Nmap scan report') === 0)

    let addr_def = {}
    for ( let line of lines ) {
        line = line.replace('Nmap scan report for ','')
        let lparts = line.split('(')
        let addr = lparts[1].trim().replace(')','')
        let host_id = lparts[0].split('.')
        host_id = host_id[0].trim()
        addr_def[addr] = host_id
    }

    return addr_def
}


module.exports.nmap_parser = nmap_parser
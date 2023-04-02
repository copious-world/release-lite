const {nmap_parser} = require('../lib/parse-nmap')


const nmapout = `
`

let rslt = nmap_parser(nmapout)

console.dir(rslt)
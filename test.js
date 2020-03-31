const Releaser = require('./lib/releasepages')

var g_release_json_file = 'example/release.json'

var g_ssh_pass = process.argv[2]
console.log(g_ssh_pass)
if ( g_ssh_pass === undefined ) {
    console.error('No ssh password provided')
    process.exit(1)
}

var releaser = new Releaser(g_ssh_pass,g_release_json_file)
releaser.run()

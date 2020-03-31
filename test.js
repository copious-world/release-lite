const Releaser = require('./lib/releasepages')

var g_release_json_file = 'example/release.json'

var g_ssh_pass = process.argv[2]
console.log(g_ssh_pass)
if ( g_ssh_pass === undefined ) {
    console.error('No ssh password provided')
    process.exit(1)
}
let ecosystem = `
    module.exports = {
        apps : [
            {
                name        : "my-app-name",
                script      : "/my-app-path/myapp.js",
                watch       : true,
                env: {
                    "NODE_ENV": "development",
                },
                env_production : {
                    "NODE_ENV": "production"
                }
            },
            {
                name        : "etc",
                script      : "/etc.js",
                watch       : true,
                env: {
                    "NODE_ENV": "development",
                },
                env_production : {
                    "NODE_ENV": "production"
                }
            }
        ]
      }
      `

var releaser = new Releaser(g_ssh_pass,g_release_json_file,ecosystem)
releaser.run()

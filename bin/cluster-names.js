#!/usr/bin/env node

let cluster_master_user = process.argv[2]
let cluster_master_addr = process.argv[3]

const { execFileSync } = require('node:child_process');


execFileSync('bash',['./run-downloader.sh', cluster_master_user, cluster_master_addr])



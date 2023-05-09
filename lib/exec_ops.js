const { execFileSync } = require('node:child_process');
const { modes } = require('tar');



async function expect_ensure_dir(pass,user,addr,remote_dir) {
    let dir_cmd = `mkdir -p ${remote_dir}`
    execFileSync('bash',['./assets/expectpw-ssh-cmd.sh', pass, user, addr, remote_dir, 'local'])
}


async function send_up(user,addr,resident_bash_script,remote_dir) {
    if ( typeof remote_dir !== 'string' ) {
        execFileSync('bash',['./assets/scp-helper.sh', user, addr, resident_bash_script])
    } else {
        execFileSync('bash',['./assets/scp-helper.sh', user, addr, resident_bash_script, remote_dir])
    }
}

async function expect_send_up(pass,user,addr,remote_dir) {
    execFileSync('bash',['./assets/expectpw-scp-helper.sh', pass, user, addr, resident_bash_script, remote_dir, 'local'])
}

async function send_dir_up(user,addr,dirname) {
    execFileSync('bash',['./assets/scp-dir-helper.sh', user, addr, dirname])
}

async function send_dir_down(user,addr,dirname) {
    if ( await fos.ensure_directories(`./${dirname}`) ) {
        execFileSync('bash',['./assets/scp-dir-fetcher.sh', user, addr, dirname])
    } else {
        console.log("send_dir_down -- cannot make local directory")
    }
}



async function perform_op(user, addr, bash_op) {
    await execFileSync('bash',['./assets/run-executer.sh', user, addr, bash_op] )   // /home/naming/cluster
}


async function perform_expect_op(pass, user, addr, bash_op, params) {
    let bash_params = [ './assets/expectpw-ssh.sh', pass, user, addr, bash_op, 'local' ]
    bash_params = bash_params.concat(params)
    await execFileSync('bash', bash_params )   // /home/naming/cluster
}

module.exports.expect_ensure_dir = expect_ensure_dir
module.exports.send_up = send_up
module.exports.expect_send_up = expect_send_up
module.exports.send_dir_up = send_dir_up
module.exports.send_dir_down = send_dir_down
module.exports.perform_op = perform_op
module.exports.perform_expect_op = perform_expect_op
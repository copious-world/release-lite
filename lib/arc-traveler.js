

const xops = require('bash-xops')
const {FileOperations} = require('extra-file-class')

let conf = false
let fos = new FileOperations(conf)


function graph_rooted_at(node,graph) {   // fix this
    return graph
}



async function ensure_json_manipulator(node,graph) {
    // ./assets/expectpw-ssh.sh sjoseij richard 76.229.181.242 test.sh nnn simple
    let addr = node.host.addr   // node 'home' reached from 'here' ... host will be 'home' pass for 'richard' user = 'richard'
    let user = node.auth.user
    let pass = node.auth.pass
    let abbr = node.abbr
    let bash_op = `./assets/apt-installer.sh`
    await xops.perform_expect_op(pass, user, addr, bash_op, ['jq'])
    await xops.expect_ensure_dir(pass,user,addr,preamble_obj.scope.master_exec_loc)
    // #
    await xops.expect_send_up(pass,user,addr,'./assets/expectpw-scp-helper.sh',preamble_obj.scope.master_exec_loc)
    await xops.expect_send_up(pass,user,addr,'./assets/apt-installer.sh',preamble_obj.scope.master_exec_loc)
    await xops.expect_send_up(pass,user,addr,'./assets/expectpw-ssh-cmd.sh',preamble_obj.scope.master_exec_loc)
    await xops.expect_send_up(pass,user,addr,'./assets/expectpw-ssh.sh',preamble_obj.scope.master_exec_loc)
    await xops.expect_send_up(pass,user,addr,'./assets/upload_scripts.sh',preamble_obj.scope.master_exec_loc)
    await xops.expect_send_up(pass,user,addr,'./assets/arc-traveler.sh',preamble_obj.scope.master_exec_loc)
    await xops.expect_send_up(pass,user,addr,'./assets/arc-traveler-setup.sh',preamble_obj.scope.master_exec_loc)

    // at this point here->home has installed desired assets on 'home'
    //
    let uploader = 'upload_scripts'
    let propagate_op = './assets/arc-traveler-setup.sh'
    let g_hat = graph_rooted_at(node,graph)
    if ( g_hat ) {
        //  make a graph string and encode it 
        let g_hat_str = JSON.stringify(g_hat)
        let g_hat_str64 = Buffer.from(g_hat_str).toString('base64')
        //  make an ops array string and encode it 
        let ops = [ 'apt-get install jq', `mkdir -p ${preamble_obj.scope.master_exec_loc}` ]
        ops = JSON.stringify(ops)
        let ops64 = Buffer.from(ops).toString('base64')
        //
        // here->home  (hence home.pass, home.user, home.abbd) which is node.user, etc.
        //
        await xops.perform_expect_op(pass, user, addr, propagate_op, [`${abbr} ${preamble_obj.scope.master_exec_loc} ${g_hat_str64} ${ops64} ${uploader}`])           
    }
    //
}



async function start_arc_traveler(node,graph) {   // assume that scripts to reside on the node are already listed on the node
    // ./assets/expectpw-ssh.sh sjoseij richard 76.229.181.242 test.sh nnn simple
    let addr = node.host.addr   // node 'home' reached from 'here' ... host will be 'home' pass for 'richard' user = 'richard'
    let user = node.auth.user
    let pass = node.auth.pass
    let abbr = node.abbr
    // #
    // at this point here->home has installed desired assets on 'home'
    //
    let scripts_to_upload = node.upload_scripts
    let all_upload_promises = []
    for ( let script of scripts_to_upload ) {
        let p = xops.expect_send_up(pass,user,addr,`./assets/${script}`,preamble_obj.scope.master_exec_loc)
        all_upload_promises.push(p)
    }
    await Promise.all(all_upload_promises)
    //
    let files_to_download = node.download_files
    let all_download_promises = []
    for ( let script of files_to_download ) {
        let p = xops.expect_send_down(pass,user,addr,`./assets/${script}`,preamble_obj.scope.master_exec_loc)
        all_upload_promises.push(p)
    }
    await Promise.all(all_download_promises)
    //
    let propagate_op = './assets/arc-traveler.sh'
    let g_hat = graph_rooted_at(node,graph)
    if ( g_hat ) {
        //  make a graph string and encode it 
        let g_hat_str = JSON.stringify(g_hat)
        let g_hat_str64 = Buffer.from(g_hat_str).toString('base64')
        //  make an ops array string and encode it 
        let ops = node.required_on_node_operations
        ops = JSON.stringify(ops)
        let ops64 = Buffer.from(ops).toString('base64')
        //
        //  make an ops array string and encode it 
        let pos_ops = node.required_on_node_post_operations
        pos_ops = JSON.stringify(ops)
        let post_ops64 = Buffer.from(pos_ops).toString('base64')
        //
        // here->home  (hence home.pass, home.user, home.abbd) which is node.user, etc.
        //
        await xops.perform_expect_op(pass, user, addr, propagate_op, [`${abbr} ${preamble_obj.scope.master_exec_loc} ${g_hat_str64} ${ops64} ${post_ops64}`])           
    }
    //
}



async function start_arc_traveler_setup(node,host_list,wdir,ops,uploader_script,traveler = 'arc-traveler-setup.sh') {   // assume that scripts to reside on the node are already listed on the node
    // ./assets/expectpw-ssh.sh sjoseij richard 76.229.181.242 test.sh nnn simple
    let addr = node.addr   // node 'home' reached from 'here' ... host will be 'home' pass for 'richard' user = 'richard'
    let user = node.user
    let pass = node.pass
    let name = node.name
    //
    let where_is_cwd = process.cwd()
    //
    await fos.dir_maker(wdir)
    //
    try {
        process.chdir(wdir);
        console.log(`New directory: ${process.cwd()}`);
    } catch (err) {
        console.error(`chdir: ${err}`);
        return false
    }

    // do everything
    await xops.run_local_script(`../assets/${uploader_script}`,["-", "-", "-", "-", "1", "local"])

    // ---- ---- ---- ---- ---- ---- ---- ----
    //
    try {
        process.chdir(where_is_cwd);
        console.log(`New directory:  ${process.cwd()}`);
    } catch (err) {
        console.error(`chdir: ${err}`);
        return false
    }


    let host_lines = host_list.map(host => host.to_csv())
    let graph_csv = host_lines.join('\n')

    let ops_t = ops.join("\n")

    let op_str = Buffer.from(ops_t).toString('base64')
    let graph_csv_str = Buffer.from(graph_csv).toString('base64')

    // do everything

    const util = require('node:util');
    const exec = util.promisify(require('node:child_process').exec);
    //
    let output = await exec(`bash ./assets/${traveler} ${name} ${wdir} '${graph_csv_str}' '${op_str}' ${uploader_script}`)
    console.log(output.stdout)

}





module.exports = {
    ensure_json_manipulator,
    start_arc_traveler_setup,
    start_arc_traveler
}
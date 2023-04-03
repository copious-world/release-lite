#!/usr/bin/env node

const fs = require('fs')
const {
    strip_front,
    popout,
    extract_popout,
    replace_eol,
    has_symbol,
    all_var_forms,
    trimmer,
    after_first_line,
    first_line,
    is_ipv6_at_first,
    is_octet_at_first,
    get_end_var_name,
    gulp_section,
    extract_object_field,
    subst_all,
    eliminate_line_start_comments,
    eliminate_empty_lines,
    table_to_objects,
    create_map_object,
    object_list_to_object
} = require('../lib/utilities')


const {nmap_parser} = require('../lib/parse-nmap')


const readline = require('readline');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const prompt = (query) => new Promise((resolve) => rl.question(query, resolve));

// When done reading prompt, exit program 
rl.on('close', () => process.exit(0));

process.on('SIGINT',() => {
    rl.close();
})


function feasable_addr_list(net_data) {
    //
    let addr_map = nmap_parser(net_data)
    //
    for ( let ky in addr_map ) {
        let octet_parts = ky.split('.')
        if ( octet_parts[3] === '254' ) {
            delete addr_map[ky]
            break
        }
    }
    return addr_map
}

async function ask_user_name_and_pass(addr_table) {

    let keepers = {}
    for ( let [ky,label] of Object.entries(addr_table) ) {
        console.log(`${label}@ ${ky}`)
        try {
            let keep = await prompt("Use this node?: ");
            while ( (keep.toUpperCase() !== 'N') && (keep.toLowerCase() !== 'no') && (keep.toLowerCase() !== 'false') ) {
                const user = await prompt(`${label}  user: `);
                const pass = await prompt(`${label}  password: `);
                keepers[ky] = {
                    "label" : label,
                    "user" : user,
                    "pass" : pass
                }
                console.dir(keepers[ky])
                keep = await prompt("Is this data correct?: ");
                if ( (keep.toUpperCase() == 'N') || (keep.toLowerCase() == 'no') || (keep.toLowerCase() == 'false') ) {
                    keep = "Y"
                } else break
            }
            console.log("------")
        } catch (e) {
            console.error("Unable to prompt", e);
        }
    }

    return keepers
}


async function prepare_controller_exec_ssh(addr_table,cluster_op_file) {
    console.log("prepare_controller_exec_ssh")
    for ( let [ky,info] of Object.entries(addr_table) ) {
        console.log(`${ky} ::`)
        console.dir(info)
    }
}


function info_line_to_object(disk_line) {
    let components = disk_line.split(/\s+/)
    // Size  Used Avail Use%
    let result = {
        "size" : components[0],
        "used" : components[1],
        "avail" : components[2],
        "%" : components[3]
    }
    return result
}

function extract_disk_devs(disk_lines) {
    let lines = disk_lines.split('\r\n')
    lines = lines.filter(line => (line.substring(0,'/dev/'.length) == '/dev/'))
    console.log(lines)
    let result = {}
    for ( let line of lines ) {
        let dev_name = popout(line,' ')
        let rest_line = line.substring(line.indexOf(' ')).trim()
        let pos = rest_line.lastIndexOf('/')
        let dev_label = rest_line.substring(pos)
        let disk_info = rest_line.substring(0,pos)
        while ( (pos = disk_info.lastIndexOf('/')) > 0 ) {
            let more_label = disk_info.substring(pos)
            disk_info = disk_info.substring(0,pos)
            dev_label = more_label + dev_label
        }
        result[dev_label] = {
            "dev" : dev_name,
            "info" : info_line_to_object(disk_info.trim())
        }
    }
    return result
}


function extract_mem_info(mem_data) {
    mem_data = mem_data.trim()
    let mem_lines = mem_data.split('\r\n')
    mem_lines = trimmer(mem_lines)
    mem_lines = mem_lines.filter(line => (line.substring(0,4) === 'Mem:'))
    let mem_info = mem_lines[0]
    if ( mem_info ) {
        mem_info = mem_info.substring(4).trim()
        mem_info = mem_info.split(/\s+/)
        let mem_map = {
            "total"  :  mem_info[0],
            "used"  :  mem_info[1],
            "free"  :  mem_info[2],
            "shared"   :  mem_info[3],
            "buff/cache"  :  mem_info[4],
            "available"  :  mem_info[5]
        }
        return mem_map
    }
    return {}
}


function extract_core_info(core_str) {
    let cores = core_str.split('\r\n\r\n')
    let proto_core = cores[0]
    proto_core = proto_core.split('\r\n')
    //
    proto_core = proto_core.filter(line => {
        let maybe_Bogo = ("BogoMIPS" == line.substring(0,"BogoMIPS".length))
        let maybe_Features = ("Features" == line.substring(0,"Features".length))
        return maybe_Bogo || maybe_Features
    })
    //
    let core_map = {
        "count"  : cores.len
    }
    for ( let line of proto_core ) {
        let ky = popout(line,':').trim()
        core_map[ky] = line.substring(line.indexOf(':')+1).trim().split(/\s+/)
        if ( core_map[ky].length === 1 ) {
            core_map[ky] = core_map[ky][0]
        }
    }

    return core_map
}






// ------- APPLICATION


let cluster_master_user = process.argv[2]
let cluster_master_addr = process.argv[3]

const { execFileSync } = require('node:child_process');

async function run() {
    //
    let bash_op = "nmapper.sh"
    execFileSync('bash',['./run-executer.sh', cluster_master_user, cluster_master_addr, bash_op])
    let net_data = fs.readFileSync('name_run.out','ascii').toString()
    //
    console.log(net_data)
    let addr_table = feasable_addr_list(net_data)
    addr_table = await ask_user_name_and_pass(addr_table)
    //
    bash_op = "controller_exec_ssh.sh"  // update this file to get the program to run over a list of addresses
    prepare_controller_exec_ssh(addr_table,bash_op) // write the file 
    //
    execFileSync('bash',['./run-executer.sh', cluster_master_user, cluster_master_addr, bash_op])

    let node_data = fs.readFileSync('name_run.out','ascii').toString()

    let data_parts = node_data.split('---------------')

    let excessive = data_parts[0]

    let ww = excessive.indexOf('password:')
    if ( ww > 0 ) {
        while ( --ww > 0 ) {
            let c = excessive[ww]
            if ( c === '@' ) break
        }
        data_parts[0] = excessive.substring(ww+1)
    }

    data_parts = trimmer(data_parts)

    let disk_data = data_parts[0]
    let disk_info = {
        "addr" : popout(disk_data,`'s`),
        "disks" : extract_disk_devs(after_first_line(disk_data))
    }
    let mem_data = extract_mem_info(data_parts[1])

    disk_info["memory"] = mem_data

    let core_data = extract_core_info(data_parts[2])
    disk_info["cpus"] = core_data

    console.log(JSON.stringify(disk_info,null,2))


    //execFileSync('bash',['./run-uploader.sh', cluster_master_user, cluster_master_addr])

}



run()

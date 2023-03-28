#!/usr/bin/env node

// run distributed installation services over ssh
//
const {
    strip_front,
    popout,
    replace_eol,
    has_symbol,
    trimmer,
    after_first_line,
    first_line,
    is_ipv6_at_first,
    is_octet_at_first,
    get_end_var_name
} = require('../lib/utilities')

const {path_table} = require('../lib/figure_paths')


const fs = require('fs')


let all_machines_script = './all-machines.conf'

let confstr = fs.readFileSync(all_machines_script).toString() // will crash if the file is not in the CWD

/// the file is not JSON parseable
/// special format


function process_preamble_acts(prog_form) {

    prog_form = prog_form.trim()
    if ( prog_form[0] === '[' ) {
        prog_form = prog_form.substring(1)
        prog_form = prog_form.substring(0,prog_form.indexOf(']'))
        prog_form = prog_form.trim()
    }

    let act_list = prog_form.split(',')

    act_list = act_list.map(act => {
        act = act.trim()
        if ( act[0] === '\"' ) {
            act = act.substring(1)
            act = act.substring(0,act.lastIndexOf('\"'))
            act = act.trim()
        }
        return act
    })

    let master = {
        "acts" : act_list
    }

    for ( let a of act_list ) {
        master[a] = {}   // to be defined
    }

    return master
}

function process_var_stack(vars) {
    let vmap = {}
    vars = strip_front(vars,'!')
    for ( let v of vars ) {
        let parts = v.split('=')
        parts = parts.map(v => { return v.trim() })
        let vname = parts[0]
        vname = vname.substring(0,vname.indexOf('>')).trim()
        vmap[vname] = parts[1]
    }

    return vmap
}



function process_preamble(preamble) {   // definite def and act section for first run subst and highest level sequence
    let parts = preamble.split('\n')
    let p1 = []
    let p2 = []
    while ( parts.length ) {
        p = parts.shift()
        if ( p === '!' ) break
        p1.push(p)
    }
    p1 = strip_front(p1,'!')
    p2 = strip_front(parts,'!')

    let master_order = { 
        "acts" : []
    }
    //
    if ( popout(p1[0],'>') === 'act' ) {
        master_order = process_preamble_acts(p1[1])
    } else if ( popout(p2[0],'>') === 'act' ) {
        master_order = process_preamble_acts(p2[1])
    }
    //
    let var_stack = { 
    }
    if ( popout(p1[0],'>') === 'def' ) {
        p1.shift()
        var_stack = process_var_stack(p1)
    } else if ( popout(p2[0],'>') === 'def' ) {
        p2.shift()
        var_stack = process_var_stack(p2)
    }

    return {
        "scope" : var_stack,
        "prog"  : master_order
    }
}



function process_host_table(table_str) {

    let tiny_cloud = []
    let table = table_str.split('\n')
    let header = table.shift()


    header = header.split('=')
    header.shift()

    header = header.map(h => h.trim() )
    //
    for ( let row of table ) {
        let els = row.split(':')
        els = els.map(h => h.trim())
        let n = header.length
        let rmap = {}
        for ( let i = 0; i < n; i++ ) {
            rmap[header[i]] = els[i]
        }
        tiny_cloud.push(rmap)
    }

    return tiny_cloud
}


function process_ssh_map(ssh_def_str) {

    let final_map = {}

    let def_sections = ssh_def_str.split('--')

    def_sections.forEach(asection => {

        let line1 = first_line(asection)
        if ( (line1.length === 0) || !is_octet_at_first(line1) || !is_ipv6_at_first(line1)) {
            asection = after_first_line(asection)
            asection = asection.trim()
        }
        //
        let sect_parts = asection.split(':')
        let key = sect_parts.shift().trim()
        sect_parts = sect_parts.join(':').replace('<!','').trim()

        final_map[key] = JSON.parse(sect_parts.trim())
    })

    return final_map
}


function process_path_abbreviations(path_defs_str) {

    let all_abbrev = {}

    path_defs_str = path_defs_str.trim()
    let parts = path_defs_str.split('!->')
    parts = trimmer(parts)

    for ( let p of parts ) {
        p = p.replace('<-!','')
        if ( p.length === 0 ) continue;
        // two or more sections 
        let l1 = first_line(p)
        let rest_p = after_first_line(p)
        let lparts = l1.split(':')
        lparts = trimmer(lparts)
        //
        let key = lparts[0]
        if ( has_symbol(lparts[1],'=') ) {
            key = get_end_var_name(lparts[1])
        }
        all_abbrev[key] = path_table(rest_p)
    }

    return all_abbrev
}


function subst_all(str,svar,value) {
    console.log(svar)
    while ( str.indexOf(svar) >= 0 ) {
        str = str.replace(svar,value)
    }
    return str
}


function process_act_entry(act_str,preamble_obj,defs_obj) {
    //
    act_str = act_str.trim()
    if ( act_str.indexOf("import") === 0 ) {
        act_str = act_str.substring("import".length).trim()
        let abs_dir = process.cwd()
        return `${abs_dir}/${act_str}`
    } else {
        let path_subst = defs_obj.path_abbreviations
        for ( let pth in path_subst.local ) {
            let pstr = path_subst.local[pth]
            act_str = subst_all(act_str,`$${pth}`,pstr)
        }
        for ( let pth in path_subst.remotes ) {
            let pstr = path_subst.remotes[pth]
            act_str = subst_all(act_str,`$${pth}`,pstr)
        }
        let act_section = act_str
        return act_section
    }
    //
}


function process_acts(acts_def,preamble_obj,defs_obj) {

    let act_map = {}
    for ( let [k,v] of Object.entries(acts_def) ) {
        console.log(k)
        act_map[k] = process_act_entry(v,preamble_obj,defs_obj)
    }

    return act_map
}



function process_defs(def_list) {
    if ( typeof def_list === 'object' ) {
        let def_map = {}
        for ( let [k,v] of Object.entries(def_list) ) {
            switch (k) {
                case "host" : {
                    def_map[k] = process_host_table(v)
                    break;
                }
                case "ssh" : {
                    if ( typeof v === 'string' ) {
                        def_map[k] = process_ssh_map(v)
                    }
                    break;
                }
                case "path_abbreviations" : {
                    def_map[k] = process_path_abbreviations(v)
                    break;
                }
                default: {
                    console.log("process defs: unkown section key: " + k)
                }
            }
        }
        return def_map
    }
    console.log("process defs:  def list is not an object")
}





// -------------------------------------


function top_level_sections(file_str) {
    let preamble = false
    let defs = {}
    let acts = {}

    let parts = file_str.split('!>')
    parts = trimmer(parts) 
    for ( let p of parts ) {
        p = p.replace('<!','')
        let l1 = first_line(p)
        let rest_p = after_first_line(p)
        let lparts = l1.split(':')
        lparts = trimmer(lparts)
        if ( lparts.length == 2 ) {
            let maybe_def = lparts[1].substring(0,3)
            if ( maybe_def == 'act' || maybe_def == 'def' ) {
                let key = lparts[0]
                if ( has_symbol(lparts[1],'=') ) {
                    key = get_end_var_name(lparts[1])
                }
                if ( maybe_def == 'act' ) acts[key] = rest_p.trim()    // replace_eol(rest_p,' ').substring(0,128)
                if ( maybe_def == 'def' ) defs[key] = rest_p.trim()    // replace_eol(rest_p,' ').substring(0,128)
            }
        } else {
            preamble = p
        }
    }

   
    return { preamble, defs, acts }
}




//

let top_level = top_level_sections(confstr)

////
let preamble_obj = process_preamble(top_level.preamble)
let defs_obj = process_defs(top_level.defs)
let acts_obj = process_acts(top_level.acts,preamble_obj,defs_obj)
console.dir(preamble_obj)
console.dir(defs_obj)
console.dir(acts_obj)
//

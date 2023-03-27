#!/usr/bin/env node

// run distributed installation services over ssh
//

const fs = require('fs')


let all_machines_script = './all-machines.conf'



let confstr = fs.readFileSync(all_machines_script).toString() // will crash if the file is not in the CWD

/// the file is not JSON parseable
/// special format




function first_line(str) {
    let eol = str.indexOf('\n')
    return str.substring(0,eol)
}

function after_first_line(str) {
    let eol = str.indexOf('\n')
    return str.substring(eol+1)
}

function trimmer(str_list) {
    return str_list.map(pstr => pstr.trim())
}

function has_symbol(str,symb) {
    let i = str.indexOf(symb)
    return (i > 0)
}


function replace_eol(rest_p,c) {
    while ( rest_p.indexOf('\n') >= 0 ) rest_p = rest_p.replace('\n',c)
    return rest_p
}


function top_level_sections(file_str) {
    let preamble = false
    let defs = {}
    let acts = {}

    let parts = file_str.split('!>')
    parts = trimmer(parts) 
    for ( let p of parts ) {
        let l1 = first_line(p)
        let rest_p = after_first_line(p)
        console.log(l1)
        let lparts = l1.split(':')
        lparts = trimmer(lparts)
        if ( lparts.length == 2 ) {
            let maybe_def = lparts[1].substring(0,3)
            if ( maybe_def == 'act' || maybe_def == 'def' ) {
                let key = lparts[0]
                if ( has_symbol(lparts[1],'=') ) {
                    let key_n_name = lparts[1].split('=')
                    key_n_name = trimmer(key_n_name)
                    rest_p = 'title: ' + 'key' + '\n' + rest_p
                    key = key_n_name[1]
                }
                if ( maybe_def == 'act' ) acts[key] = replace_eol(rest_p,' ').substring(0,128)
                if ( maybe_def == 'def' ) defs[key] = replace_eol(rest_p,' ').substring(0,128)
            }
        } else {
            preamble = rest_p
        }
    }

    console.log("----------PREAMBLE---------------")
    console.log(preamble)
    console.log("----------------DEFS---------")
    console.dir(defs)
    console.log("------------------ACTS-------")
    console.dir(acts)
    console.log("---------------------DONE----")
}




//

top_level_sections(confstr)

//
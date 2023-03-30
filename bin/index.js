#!/usr/bin/env node

// run distributed installation services over ssh
//
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
    eliminate_empty_lines
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



function map_by_key(h,tiny_cloud) {
    let hmap = {}
    for ( let cel of tiny_cloud ) {
        hmap[cel[h]] = cel
    }
    return hmap
}



function process_host_table(table_str) {

    let tiny_cloud_list = []
    let table = table_str.split('\n')
    let header = table.shift()
    //
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
        tiny_cloud_list.push(rmap)
    }

    let by_key = {}
    for ( let h of header ) {
        by_key[h] = map_by_key(h,tiny_cloud_list)
    }

    let tiny_cloud = {
        "_list" : tiny_cloud_list,
        "by_key" : by_key
    }

    return tiny_cloud
}


function process_ssh_map(ssh_def_str) {
    let final_map = {}

    let def_sections = ssh_def_str.split('~!')

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





// ---- expand_section
function expand_section(section_def,rest_sect_str) {
    let spec_vars = section_def.top_dir_location
    let section = rest_sect_str.trim()
    if ( spec_vars ) {
        for ( let [pth,pstr] of Object.entries(spec_vars) ) {
            section = subst_all(section,`$\{${pth}}`,pstr)
        }
    }
    section_def.converted = section
    return section_def
}




function process_act_entry(act_str,preamble_obj,defs_obj) {
    //
    act_str = act_str.trim()
    if ( act_str.indexOf("import") === 0 ) {
        act_str = act_str.substring("import".length).trim()
        let abs_dir = process.cwd()
        return `${abs_dir}/${act_str}`
    } else {
        let top_vars = preamble_obj.scope
        for ( let [k,v]  of Object.entries(top_vars) ) {
            act_str = subst_all(act_str,`$\{${k}}`,v)
            act_str = subst_all(act_str,`$${k}`,v)
        }

        let path_subst = defs_obj.path_abbreviations
        for ( let pth in path_subst.local ) {
            let pstr = path_subst.local[pth]
            act_str = subst_all(act_str,`$${pth}`,pstr)
        }
        for ( let pth in path_subst.remotes ) {
            let pstr = path_subst.remotes[pth]
            act_str = subst_all(act_str,`$${pth}`,pstr)
        }
        let act_section = {}
        //
        let [sect_str,rest_sect] = gulp_section(act_str,'|-','-|')
        //
        if ( sect_str ) {
            let fieldobj_list = sect_str.split('--')
            fieldobj_list = trimmer(fieldobj_list)
            for ( let fo of fieldobj_list ) {
                if ( fo.length ) {
                    let [sect_key,sect_object] = extract_object_field(fo)
                    act_section[sect_key] = sect_object
                }
            }
            //
            act_section = expand_section(act_section,rest_sect)    
        } else {
            act_section.converted = act_str
        }       
        //
        return act_section
    }
    //
    return false
}


function host_abbrev_to_addr(hname,hosts) {
console.log(hname)
console.log(hosts)
    let hmap = hosts.by_key['abbr']
console.log(hmap)
    return hmap[hname].addr
}


function get_dot_val(lk,access) {
    let i = 0;
    let v = access[lk[0]]
    let n = lk.length
    for ( let i = 1; i < n; i++ ) {
        if ( v === undefined ) return ""
        v = v[lk[i]]
    }
    return v
}

// ---

function acts_generator(act_map,acts_def,preamble_obj,defs_obj) {
    //
    for ( let [act,code] of Object.entries(act_map) ) {
        //
        switch ( act ) {
            case "of-this-world" : {
                //break
            }
            default : {
                if ( typeof code === 'object') {
                    let c_str = code.converted
                    let string_parts = {}
                    //
                    let host_list = []
                    //
                    let tindex = c_str.indexOf('!~')
                    if ( tindex >= 0 ) {
                        //
                        let host_sections = c_str.split('!~')
                        if ( host_sections[0].length === 0 ) host_sections.shift()
                        //
                        for ( let sect of host_sections ) {
                            let hname = first_line(sect).trim()
                            let txt = after_first_line(sect)
                            let addr = host_abbrev_to_addr(hname,defs_obj.host)
                            string_parts[addr] = txt
                            host_list.push(addr)
                        }
                        //
                    } else {
                        host_list = defs_obj.host._list.map(h => h.addr)
                    }


                    //
                    let output_map = {}
                    let sshvals = defs_obj.ssh
                    let hosts = defs_obj.host.by_key.addr
                    let access = {
                        "host" : hosts,
                        "ssh" : sshvals
                    }
                    let var_forms = all_var_forms(c_str)
    //console.dir(var_forms)
                    let unwrapped_vars = Object.keys(var_forms).map(vf => { 
                        let stopper = '}'
                        if ( vf[1] === '[') stopper = ']'
                        let vk = vf.substring(2).replace(stopper,'')
                        let fields = vk.split('.')
                        return [vf,fields]
                    })
                    //
                    let vf_lookup = {}
                    for ( let vfpair of unwrapped_vars ) {
                        vf_lookup[[vfpair[0]]] = vfpair[1]
                    }
                    //
                    for ( let h of host_list ) {
                        let h_out = (tindex < 0) ? ("" + c_str) : ("" + string_parts[h])
                        for ( let vf in var_forms ) {
                            let lk = [].concat(vf_lookup[vf])
                            lk.splice(1,0,h)
                            let val = get_dot_val(lk,access)
                            //
                            let starters = h_out.split(vf)
                            h_out = starters.join(val)
                            // 
                        }
                        //
                        output_map[h] = h_out
                    }
                    //
                    act_map[act].outputs = output_map   
                }
                //
                break;
            }
        }
        //
    }
    //
}


function process_acts(acts_def,preamble_obj,defs_obj) {

    let act_map = {}
    for ( let [k,v] of Object.entries(acts_def) ) {
        act_map[k] = process_act_entry(v,preamble_obj,defs_obj)
    }

    acts_generator(act_map,acts_def,preamble_obj,defs_obj)

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


function gen_repstr(depth,c) {
    let str = ''
    while ( depth-- ) {
        str += c
    }
    return str
}


function subsequence_output(o_vals,content,depth) {
    //
    let depth_indicator = gen_repstr(depth,'-')
    let order_finder = `=${depth_indicator}>`
    let depth_sep = `!${depth_indicator}`
    let dsl = depth_sep.length
    //
    let i = content.indexOf(depth_sep)
    let level_indicators = []
    while ( i >= 0 ) {
        if ( content[i+dsl] !== '-' ) {
            level_indicators.push(i)
        }
        i = content.indexOf(depth_sep,i+1)
    }
    //
    let n = level_indicators.length
    let section_list = []
    for ( let j = 0; j < n; j++ ) {
        let start = level_indicators[j]
        let end = level_indicators[j+1]
        let section = ''
        if ( end === undefined ) {
            section = content.substring(start)
        } else {
            section = content.substring(start,end)
        }
        section_list.push(section)
    }

    let key_map = {}
    for ( let sect of section_list ) {
        sect = sect.trim()
        let key = popout(sect,'>')
        key = key.substring(depth+1,sect.indexOf('>'))
        key_map[key] = sect.substring(sect.indexOf('>') + 1).trim()
    }

    let final_output = ""

    for ( let ky of o_vals ) {

        let sect = key_map[ky]

        if ( sect === undefined ) {
            console.log("undefined section name in ordering: ",ky," depth: ",depth)
            console.dir(key_map)
            continue
        }

        if ( sect[0] === '=' ) {
            sect = sect.substring(1)
        } else {
            sect = sequence_output(sect,depth+1,order_finder)
        }

        final_output += sect
        final_output += '\n'

    }


    //
    return final_output
}


function sequence_output(output,depth=1,order_finder) {

    let ordering_loc = order_finder ? output.indexOf(order_finder) : output.indexOf('=>')
    let seq_output = ''
    if ( ordering_loc > 0 ) {

        let ordering = output.substring(ordering_loc)
        let content = output.substring(0,ordering_loc)
        //
        try {
            let o_vals = ordering.split(':')[1]
            //
            o_vals = o_vals.trim()
            if ( o_vals[0] === '[' ) {
                o_vals = o_vals.substring(1)
                o_vals = o_vals.replace(']','')
            }
            //
            o_vals = o_vals.split(',')
            o_vals = trimmer(o_vals)
    
            seq_output = subsequence_output(o_vals,content,depth)
        } catch (e) {
            console.log(depth)
            console.log("ordering line badly formatted")
        }
    }

    return seq_output
}



//
confstr = eliminate_line_start_comments(confstr,'--')
confstr = eliminate_empty_lines(confstr)
let top_level = top_level_sections(confstr)

////
let preamble_obj = process_preamble(top_level.preamble)
let defs_obj = process_defs(top_level.defs)
let acts_obj = process_acts(top_level.acts,preamble_obj,defs_obj)
//console.dir(preamble_obj)
//console.dir(defs_obj)
//console.log(JSON.stringify(defs_obj,null,2))
// console.dir(acts_obj)
//console.log(JSON.stringify(acts_obj,null,2))
//


for ( let ky in acts_obj ) {
    let target = acts_obj[ky]
    if ( target.outputs !== undefined ) {
        for ( let [addr,output] of Object.entries(target.outputs) ) {
            output = sequence_output(output)
            //fs.writeFileSync(`./scripts/${ky}-${addr}.sh`,output)
            console.log(output)
            console.log('--------------------------------------------------------------')
        }        
    }
}
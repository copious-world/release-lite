#!/usr/bin/env node

// run distributed installation services over ssh
//
const {
    iswhite,
    strip_front,
    popout,
    popout_match,
    popout_rest_match,
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

const {path_table} = require('../lib/figure_paths')


const fs = require('fs')
const {FileOperations} = require('extra-file-class')
let fos = new FileOperations()



const IMP_RULE_MARKER = '&|.'
const OBJ_LIST_TYPE_MARKER = '(~!)'
const TABLE_ROW_COL_TYPE_MARKER = '(=)'

const g_out_dir_prefix = './scripts'

let all_machines_script = './all-machines.conf'

let confstr = fs.readFileSync(all_machines_script).toString() // will crash if the file is not in the CWD

let g_cmd_gen_filter = {}
let filter_json_name = 'save-data/select-machine-actions.json'
try {
    let filterstr = fs.readFileSync(filter_json_name).toString() // will do not filtering unless this file is present
    g_cmd_gen_filter = JSON.parse(filterstr)
    console.log(filter_json_name + " will be used to selection actions")
} catch (e) {
    console.log("All actions will be perormed: " + filter_json_name + " has not been found")
}



/// the file is not JSON parseable
/// special format


function casual_array_to_array(o_vals) {
    o_vals = o_vals.trim()
    if ( o_vals[0] === '[' ) {
        o_vals = o_vals.substring(1)
        o_vals = o_vals.replace(']','')
        //
        o_vals = o_vals.split(',')
        o_vals = trimmer(o_vals)
    }
    return o_vals 
}

function r_remove_field(top,fname) {
    if ( top[fname] !== undefined ) {
        delete top[fname]
    }
    for ( let val of Object.values(top) ) {
        if ( typeof val === "object" ) {
            r_remove_field(val,fname)
        }
    }
    return top
}


function get_type_specifier(str) {
    let type = str.substring(str.indexOf('('),str.indexOf(')')+1)
    return type
}


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

function get_type_marker(table_str,deflt) {
    let table_type = deflt
    if ( table_str[0] === '(' ) {
        table_type = table_str.substring(0,table_str.indexOf(')')+1)
        table_str = table_str.replace(table_type,'').trim()
    }
    return [table_type,table_str]
}


function import_rule(ts) {
    return ( ts.indexOf(IMP_RULE_MARKER) === 0 )
}

function figure_def_import_rule(ts,table_type) {
    let rule = first_line(ts)
    ts = after_first_line(ts)
    rule = rule.replace(IMP_RULE_MARKER,'').trim()
    let directive = popout_match(rule,/\s+/)
    rule = popout_rest_match(rule,/\s+/)
    let sourcer = popout_match(rule,/\s+/)
    rule = popout_rest_match(rule,/\s+/)
    //
    if ( sourcer === 'import' ) {
        try {
            let srcd = fs.readFileSync(rule).toString()
            srcd = srcd.trim()

            if ( srcd[0] === '=' ) {
                if ( table_type !== TABLE_ROW_COL_TYPE_MARKER ) {
                    console.log("table type does not match data in file")
                    directive = 'must'
                    throw new Error("type/file mismatch in def section")
                }
                //
                switch ( directive ) {
                    case 'maybe' : {
                        ts  = srcd
                        break
                    }
                    case 'must' : {
                        srcd = after_first_line(srcd)
                        ts += '\n' + srcd
                        break
                    }
                    default : break
                }

            } else {  // making assumption that it will be the right syntax for (~!)
                if ( table_type !== OBJ_LIST_TYPE_MARKER ) {
                    console.log("table type does not match data in file")
                    directive = 'must'
                    throw new Error("type/file mismatch in def section")
                }
                //
                switch ( directive ) {
                    case 'maybe' : {
                        ts  = srcd
                        break
                    }
                    case 'must' : {
                        ts += OBJ_LIST_TYPE_MARKER
                        ts += srcd
                        break
                    }
                    default : break
                }
            }


        } catch (e) {
            if ( directive === "maybe" ) {
                return ts
            } else if ( directive === "must" ) {
                console.log(e)
                throw new Error(`Could not load file ${rule} when requiring extra host information`)
            }
        }
    }


    return ts
}



function process_host_table(table_str) {
    //
    let [table_type,ts] = get_type_marker(table_str,TABLE_ROW_COL_TYPE_MARKER)
    //
    if ( import_rule(ts) ) {
        ts = figure_def_import_rule(ts,table_type)
    }
    //
    let tiny_cloud_list = []
    let by_key = {}
    if ( table_type === OBJ_LIST_TYPE_MARKER ) {
        tiny_cloud_list = object_list_to_object(ts)
        let header = Object.keys(tiny_cloud_list[0])
        by_key = create_map_object(header,tiny_cloud_list)
    } else {
        let [tcl,bk,header] = table_to_objects(ts)
        tiny_cloud_list = tcl
        by_key = bk
    }

    let tiny_cloud = {
        "_list" : tiny_cloud_list,
        "by_key" : by_key,
        "master" : false
    }
    //
    let hosts = tiny_cloud.by_key.host 
    for ( let [key,rec] of Object.entries(hosts) ) {
        if ( key.toLowerCase().substring(0,"@master".length) === "@master" ) {
            tiny_cloud.master = rec
        }
    }
    //
    return tiny_cloud
}



function process_ssh_map(ssh_def_str) {
    //
    let [table_type,ts] = get_type_marker(ssh_def_str,OBJ_LIST_TYPE_MARKER)
    //
    if ( import_rule(ts) ) {
        ts = figure_def_import_rule(ts,table_type)
    }
    //
    ssh_def_str = ts
    ssh_def_str = ssh_def_str.replace('<!','')
    //
    let final_map
    if ( table_type === OBJ_LIST_TYPE_MARKER ) {
        final_map = object_list_to_object(ssh_def_str)
    } else {
        let [tiny_cloud_list,by_key,header] = table_to_objects(ts)
        final_map = by_key[header[0]]
    }
    //
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
}


function host_abbrev_to_addr(hname,hosts) {
//console.log(hname)
//console.log(hosts)
    let hmap = hosts.by_key['abbr']
    return hmap[hname].addr
}


function get_dot_val(lk,access,index) {
    let i = 0;
    let v = access[lk[0]]
    let n = lk.length
    for ( let i = 1; i < n; i++ ) {
        v = v[lk[i]]
        if ( Array.isArray(v) ) {
            if ( index !== undefined ) {
                v = v[index]
            } else {
                v = v.map(el => get_dot_val(lk.slice(i+1),v,index))
            }
        }
        if ( v === undefined ) return ""
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
                            if ( hname === 'all' ) {
                                let txt = after_first_line(sect)
                                string_parts['all'] = txt
                                host_list.push(['all',defs_obj.host._list.map(h => h.addr)])
                            } else {
                                let txt = after_first_line(sect)
                                let addr = host_abbrev_to_addr(hname,defs_obj.host)
                                string_parts[addr] = txt
                                host_list.push(addr)    
                            }
                        }
                        //
                    } else {
                        host_list = defs_obj.host._list.map(h => h.addr)
                    }

                    //
                    let output_map = {}
                    let sshvals = defs_obj.ssh
                    let hosts = defs_obj.host.by_key.addr
                    let master = defs_obj.host.master
                    master = Object.assign(master,sshvals[master.addr])
                    master[master.addr] = master        /// cicrular but, the indexer uses it
                    let access = {
                        "host" : hosts,
                        "ssh" : sshvals,
                        "master" : master
                    }
                    let var_forms = all_var_forms(c_str)

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
                        if ( Array.isArray(h) ) {
                            if ( h[0] === 'all' ) {
                                let hlist = h[1]
                                let addr_o_map = {}
                                output_map['all'] = addr_o_map
                                for ( hh of hlist ) {
                                    let ha = string_parts['all']
                                    for ( let vf in var_forms ) {
                                        let lk = [].concat(vf_lookup[vf])
                                        if ( lk[0] !== 'master' ) {
                                            lk.splice(1,0,hh)
                                        } else {  // use the address of the master
                                            lk.splice(1,0,access.master.addr)
                                        }
                                        let val = get_dot_val(lk,access,0)
                                        //
                                        let starters = ha.split(vf)
                                        ha = starters.join(val)
                                    }
                                    addr_o_map[hh] = ha
                                }
                            }
                        } else {
                            let h_out = (tindex < 0) ? ("" + c_str) : ("" + string_parts[h])
                            for ( let vf in var_forms ) {
                                let lk = [].concat(vf_lookup[vf])
                                //
                                if ( lk[0] !== 'master' ) {
                                    lk.splice(1,0,hh)
                                } else {  // use the address of the master
                                    lk.splice(1,0,access.master.addr)
                                }
                                //
                                let val = get_dot_val(lk,access,0)
                                //
                                let starters = h_out.split(vf)
                                h_out = starters.join(val)
                            }
                            output_map[h] = h_out
                        }
                    }
                    //
                    if ( output_map['all'] !== undefined ) {        // the very special section 'all' perhaps handled clumbsily
                        let sub_map = output_map['all']
                        delete output_map['all']
                        for ( let [ky,val] of Object.entries(sub_map) ) {
                            if ( output_map[ky] !== undefined ) {
                                if ( Array.isArray(output_map[ky]) ) {
                                    output_map[ky].push(val)
                                } else {
                                    output_map[ky] = [output_map[ky],val]
                                }
                            } else {
                                output_map[ky] = val
                            }
                        }
                    }
                    //
                    act_map[act].outputs = output_map   
                } else if ( typeof code === 'string' ) {
                    if ( code.substring(code.lastIndexOf('.')) === '.conf' ) {
                        try {
                            let file = code
                            let subcode = fs.readFileSync(file).toString() // the string read must be an act
                            act_map[act] = process_act_entry(subcode,preamble_obj,defs_obj)
                            acts_generator(act_map,acts_def,preamble_obj,defs_obj)
                        } catch (e) {
                            console.log(e)
                            console.log('could not read file ... skipping ... ')
                        }
                    }
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
    //
    let act_map = {}
    for ( let [k,v] of Object.entries(acts_def) ) {
        act_map[k] = process_act_entry(v,preamble_obj,defs_obj)
    }
    //
    acts_generator(act_map,acts_def,preamble_obj,defs_obj)  // the entries of acts map has a string for each IP and vars subst done
console.log(JSON.stringify(act_map,null,2))
    //
    return act_map
}



function process_defs(def_list) {
    if ( typeof def_list === 'object' ) {
        let def_map = {}
        for ( let [k,v] of Object.entries(def_list) ) {
            switch (k) {
                case "host" : {
                    def_map[k] = process_host_table(v)
                    //console.log(k,def_map[k])
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
                let type = ""
                if ( has_symbol(lparts[1],'(') ) {
                    type = get_type_specifier(lparts[1])
                    lparts[1] = lparts[1].replace(type,'')
                }
                if ( has_symbol(lparts[1],'=') ) {
                    key = get_end_var_name(lparts[1])
                }
                if ( maybe_def == 'act' ) acts[key] = rest_p.trim()    // replace_eol(rest_p,' ').substring(0,128)
                if ( maybe_def == 'def' ) defs[key] = type + rest_p.trim()    // replace_eol(rest_p,' ').substring(0,128)
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
    let special_file_deposit = {}
    for ( let sect of section_list ) {
        sect = sect.trim()
        let key = popout(sect,'>')
        key = key.substring(depth+1,sect.indexOf('>'))
        let sctstr = sect.substring(sect.indexOf('>') + 1).trim()
        if ( sctstr.substring(0,2) === '|<' ) {
            special_file_deposit[key] = first_line(sctstr)
            sctstr = after_first_line(sctstr)
        }
        key_map[key] = sctstr
    }

    let seconded = Object.keys(special_file_deposit).length > 0

    let final_output = ""
    let do_coalesce = false

    for ( let ky of o_vals ) {


        let sect = key_map[ky]

        if ( ky === 'nginx') {
            console.log("NGINX")
            console.log(sect)
        }


        if ( sect === undefined ) {
            console.log("undefined section name in ordering: ",ky," depth: ",depth)
            continue
        }

        if ( (sect[0] === '=') && (order_finder !== sect.substring(0,order_finder.length)) ) {
            sect = sect.substring(1)
        } else {
            sect = sequence_output(sect,depth+1,order_finder,( ky === 'nginx'))
        }

        if ( seconded ) {
            let output_directive = special_file_deposit[ky]
            if ( output_directive && output_directive.length > 0 ) {
                let od_parts = output_directive.split('|')
                od_parts.shift()
                //
                let inserts = od_parts[0].trim()
                let params = od_parts[1].trim()
                let ins_parts = inserts.split('<')
                ins_parts.shift()
                ins_parts = trimmer(ins_parts)
                //
                if ( (ins_parts[0] === 'expect') || (ins_parts[0] === 'expect:coalesce') ) {
                    do_coalesce = (ins_parts[0] === 'expect:coalesce')
                    if ( ins_parts[1] === 'ssh' ) {
                        let filespec = ins_parts[2]
                        if ( filespec.substring(0,"file".length) === "file" ) {
                            let fname = filespec.substring(4).trim()
                            if ( fname[0] === '=' ) {
                                fname = fname.replace('=','').trim()
                            }
                            //
                            let cmd_line = `expect ./expectpw-exec.sh ${params} ${fname} >> name_run.out`
                            //
                            // check if written once... 
                            fs.writeFileSync(`${g_out_dir_prefix}/${fname}`,sect)
                            sect = cmd_line
                        }
                    }
                }
                //
                // `expect ./expectpw-exec.sh dietpi root 192.168.1.71 pars-act.sh >> name_run.out`
                //
            }
        }

        final_output += sect
        final_output += '\n'    
    }

    if ( do_coalesce ) {
        return [final_output]
   }

    //
    return final_output
}


//
// chase_depth(content,depth)
//
function chase_depth(content,depth,key) {
    /*
    if ( key == 'dirs' ) {
        console.log("------------- DIRS ---------------------")
        console.log(content)
    }
    */
    // ----
    content = content.trim()
    // ----
    let depth_indicator = gen_repstr(depth,'-')
    let pop_depth_indicator = gen_repstr(depth-1,'-')
    let order_finder = `=${pop_depth_indicator}>`
    let depth_sep = `!${depth_indicator}`

    // pop off the parent ordering first...
    // ---- ---- ---- ---- ---- ---- ---- ----
    let ordering_loc = content.indexOf(order_finder)
    let ordering = false
    if ( ordering_loc >= 0 ) {
        ordering = content.substring(ordering_loc)
        content = content.substring(0,ordering_loc)
    }
    // ---- ---- ---- ---- ---- ---- ---- ----
    let dsl = depth_sep.length
    //
    let i = content.indexOf(depth_sep)
    if ( i < 0 ) return content
    
    if ( key == 'dirs' ) {
        console.log("dirs",i)
    }

    let cmd_line = false
    if ( i > 0 ) {
        cmd_line = content.substring(0,i).trim()
        content = content.substring(i).trim()
        i = 0
    }
/*
    if ( key == 'dirs' ) {
        console.log("dirs",cmd_line)
        console.log(content)
    }
*/

    //
    let level_indicators = []
    while ( i >= 0 ) {
        let c = content[i+dsl]
        if ( (c !== '-') && !iswhite(c) ) {
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


    // ---- ---- ---- ---- ---- ---- ---- ----
    // ---- ---- ---- ---- ---- ---- ---- ----


    //
    let o_vals = ordering.split(':')[1]
    //
    if ( o_vals !== undefined ) {
        o_vals = casual_array_to_array(o_vals)
    }
    //
    let top_ctrl = {
        "cmd_line" : cmd_line,
        "ordering" : o_vals
    }

    if ( cmd_line && cmd_line.indexOf('\n') > 0 ) {
        let lines = cmd_line.split('\n')
        top_ctrl.cmd_line = lines.shift()
        top_ctrl.lines = lines.map(line => {
            line = line.replace(`!${pop_depth_indicator}`,'')
            return(line.trim())
        })
    }
    //
    let found_ordering = []
    for ( let sect of section_list ) {
        let key = popout(sect,'>')
        key = key.replace(depth_sep,'')
        found_ordering.push(key)
        sect = sect.replace(`${depth_sep}${key}>`,'').trim()
        //
        top_ctrl[key] = chase_depth(sect,depth+1,key)
        if ( typeof top_ctrl[key] === 'string' ) {
            //
            top_ctrl[key] = top_ctrl[key].trim()
            top_ctrl[key] = top_ctrl[key].substring(1)
            let check_prolix = top_ctrl[key]
            if ( check_prolix.indexOf(`\n`) > 0 ) {
                if ( check_prolix.indexOf(`\n${depth_sep}`) > 0 ) {
                    check_prolix = check_prolix.split(`\n${depth_sep}`)
                } else {
                    check_prolix = check_prolix.split(`\n`)
                }
                check_prolix = trimmer(check_prolix)
                top_ctrl[key] = {
                    "cmd_line" : check_prolix.shift()
                }
                if ( top_ctrl[key].cmd_line && top_ctrl[key].cmd_line.indexOf('\n') > 0 ) {

                    let lines = top_ctrl[key].cmd_line.split('\n')
                    top_ctrl[key].cmd_line = lines.shift()
                    top_ctrl[key].lines = lines.map(line => {
                        return(line.replace(depth_sep,'').trim())
                    })
                }

                let lines = []
                let movers = []
                for ( let line of check_prolix ) {
                    if ( line[0] == '=' ) line = line.substring(1).trim()
                    if ( line.indexOf('->') > 0 ) {
                        let [from,to] = line.split('->')
                        movers.push({
                            "from" : from.trim(),
                            "to" : to.trim()
                        })
                    } else {
                        lines.push(line)
                    }
                }
                //
                top_ctrl[key].lines = lines.length ? lines : undefined
                top_ctrl[key].movers = movers.length ? movers : undefined
            } else if ( check_prolix.indexOf(`->`) > 0 ) {
                //
                let [from,to] = check_prolix.split('->')
                top_ctrl[key] = {
                    "from" : from.trim(),
                    "to" : to.trim()
                }
                //
            } else if ( check_prolix.indexOf('|=') > 0 ) {
                check_prolix = check_prolix.split('|=')
                check_prolix = trimmer(check_prolix)
                top_ctrl[key] = {
                    "cmd_line" : check_prolix[0],
                    "line" : check_prolix[1]
                }
            }
            //
        }
    }


    // ---- ---- ---- ---- ---- ---- ---- ----
    // ---- ---- ---- ---- ---- ---- ---- ----

    if ( top_ctrl.ordering == undefined ) {
        top_ctrl.ordering = found_ordering
    } else {
        let forced_ordering = []
        for ( let ky of found_ordering ) {
            if ( top_ctrl.ordering.indexOf(ky) >= 0 ) {
                forced_ordering.push(ky)
            }
        }
        top_ctrl.ordering = forced_ordering
    }

    return(top_ctrl)

}



/*
function sequence_output(output,depth=1,order_finder,do_testing) {

    let testing = false

    if ( depth === 1 ) {
        console.log(output)
        console.log("---------------------------")
        let top = chase_depth(output,1)
        if ( top ) console.log("TOP")
    }


    let ordering_loc = order_finder ? output.indexOf(order_finder) : output.indexOf('=>')
    let seq_output = ''
    if ( ordering_loc >= 0 ) {

        let ordering = output.substring(ordering_loc)
        let content = output.substring(0,ordering_loc)
        //
        //console.log(ordering)
        //
        try {
            let o_vals = ordering.split(':')[1]
            //
            o_vals = o_vals.trim()
            if ( o_vals[0] === '[' ) {
                o_vals = o_vals.substring(1)
                o_vals = o_vals.replace(']','')
                //
                o_vals = o_vals.split(',')
                o_vals = trimmer(o_vals)
            } else if ( parseInt(o_vals) !== NaN ) {
                console.log("FOUND AN INT ORDER")
            } else {
                console.log("DON'T GET IT !!",o_vals)
            }
            //
            if ( testing ) console.log(o_vals)
            //
            seq_output = subsequence_output(o_vals,content,depth)
        } catch (e) {
            console.log(e)
            console.log(depth)
            console.log("ordering line badly formatted")
        }
    } else {
        //console.log("DON'T GET IT AT ALL !!",output)
    }

    return seq_output
}
*/


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
//console.dir(acts_obj)
//console.log(JSON.stringify(acts_obj,null,2))
//


//console.log(preamble_obj.prog.acts)


let coalescing = []

for ( let ky of preamble_obj.prog.acts ) {
    let target = acts_obj[ky]
    if ( target.outputs !== undefined ) {
        coalescing = []
        for ( let [addr,output] of Object.entries(target.outputs) ) {
            // ---- ---- ---- ---- ----
            console.log("---------------------------")
            let top = chase_depth(output,1,addr)
            if ( top ) {
                let conententless = r_remove_field(top,'content')
                //console.log(JSON.stringify(conententless,null,2))
            }
/*
            output = sequence_output(output)

            if ( Array.isArray(output) ) {
                coalescing = coalescing.concat(output)
            } else {
                fos.output_string(`${g_out_dir_prefix}/${ky}-${addr}.sh`,output)
            }
            //console.log(output)
            //console.log('--------------------------------------------------------------')
            */
        }  
        if ( coalescing.length ) {
            let oo = coalescing.join('\n')
            fos.output_string(`${g_out_dir_prefix}/${ky}.sh`,oo)
        }
    }
}


// mkdir -p foo/bar/zoo/andsoforth
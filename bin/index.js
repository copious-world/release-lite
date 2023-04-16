#!/usr/bin/env node

// run distributed installation services over ssh
//
const {
    iswhite,
    strip_front,
    popout,
    popafter,
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
    eliminate_line_end_comments,
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


function from_subst(out_str,var_forms,vf_lookup,access,maybe_addr) {
    for ( let vf in var_forms ) {
        let lk = [].concat(vf_lookup[vf])
        //
        if ( lk[0] !== 'master' ) {
            lk.splice(1,0,maybe_addr)
        } else {  // use the address of the master
            lk.splice(1,0,access.master.addr)
        }
        //
        let val = get_dot_val(lk,access,0)
        //
        let starters = out_str.split(vf)
        out_str = starters.join(val)
    }
    return out_str
}


function unpack_values_transform(tmpl_str,maybe_addr) {
    // --- generalize this
    let var_forms = all_var_forms(tmpl_str)
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
    if ( Object.keys(var_forms).length ) {
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
        tmpl_str = from_subst(tmpl_str,var_forms,vf_lookup,access,maybe_addr)
    }
    return tmpl_str
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
                                    ha = from_subst(ha,var_forms,vf_lookup,access,hh)
                                    addr_o_map[hh] = ha
                                }
                            }
                        } else {
                            let h_out = (tindex < 0) ? ("" + c_str) : ("" + string_parts[h])
                            h_out = from_subst(h_out,var_forms,vf_lookup,access,hh)
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



function depth_line_classifier(output,addr,sect_name) {
    // --
    let tree = {
        "addr" : addr,
        "sect" : sect_name,
        "classified" : [
            { "type" : 'global', "depth" : 0, "sect" : sect_name, "line" : "" }  // this is the top of the structure figured by the call
        ]
    }
    // --
    let olines = output.split('\n')
    for ( let line of olines ) {
        if ( line[0] === '!' ) {        // handle something actionable
            let depth = 0
            for ( let j = 1; j < line.length; j++ ) {
                if ( line[j] !== '-' ) break;
                depth = j
            }
            line = line.substring(depth+1).trim()
            if ( line[0] === '|' || line[0] === '=' || line[0] === '@' ) {  // means just white space before ops -- no optional order
                let N = tree.classified.length
                let add_to = tree.classified[N-1]
                if ( add_to ) {
                    add_to.line += " | " + line.trim()
                }    
            } else {
                let sub_name = popout(line,'>')
                let rest = popafter(line,'>').trim()
                let typer = rest.substring(0,2)
                let ltype = 'sect'
                switch ( typer[0] ) {
                    case '@' : { ltype = 'placer'; break; }
                    case '|' : { 
                        ltype = 'param'; 
                        switch ( typer[1] ) {
                            case '>' : { ltype = 'move'; break; }
                            case '<' : { ltype = 'exec'; break; }
                        }
                        break; 
                    }
                    case '=' : { ltype = 'cmd'; break;}
                }
                let classifier = {
                    "type" : ltype,
                    "depth" : depth, 
                    "sect" : sub_name, 
                    "line" : rest
                }
                tree.classified.push(classifier)
            }
        } else if ( line[0] == '=' ) {  // handle end of sub section and ordering
            let depth = 0
            for ( let j = 1; j < line.length; j++ ) {
                if ( line[j] !== '-' ) break;
                depth = j
            }

            line = line.substring(depth+2).trim()  // should be a '>' after --
            let ltype = popout(line,'(')
            let sub_name = ""
            let rest = ""
            if ( ltype.length === 0 ) {
                if ( line.indexOf(':') > 0 ) {
                    ltype = line.split(':')
                    rest = ltype[1].trim()
                    ltype = ltype[0].trim()
                    sub_name = sect_name
                } else {
                    ltype = line.trim()
                    sub_name = sect_name
                }
            } else {
                sub_name = popout(line,')')
                sub_name = popafter(sub_name,'(')
                rest = popafter(line,')').trim()
            }

            if ( rest[0] === ':' ) {
                rest = rest.substring(1).trim()
            }

            let classifier = {
                "type" : ltype,
                "depth" : depth, 
                "sect" : sub_name, 
                "line" : rest
            }

            tree.classified.push(classifier)
        } else {    // this should be a continuatino of the previous line
            let N = tree.classified.length
            let add_to = tree.classified[N-1]
            if ( add_to ) {
                add_to.line +=  " | " + line.trim()
            }
        }
    }

    return tree
}


function build_tree(sect_list,index,depth) {
    let top = sect_list[index]
    if ( top.siblings === undefined ) {
        top.siblings = []           // top ... maybe
    }
    if ( top.subs === undefined ) {
        top.subs = []
    }
    let re_top = top
    let n = sect_list.length
    for ( let i = (index+1); i < n; i++ ) {
        index = i
        let sub = sect_list[i]
        if ( sub.depth === depth ) {
            top.siblings.push(sub)
            if ( re_top.subs && re_top.subs.length === 0 ) delete re_top.subs
            re_top = sub
            if ( re_top.subs === undefined )re_top.subs = []
        } else if ( sub.depth > depth ) {
            re_top.subs.push(sub)
            i = build_tree(sect_list,index,sub.depth)
        } else if ( sub.depth < depth ) {
            index--
            break
        }
        sect_list[index] = sub.sect
    }
    //
    if ( re_top !== top ) {
        if ( re_top.siblings && re_top.siblings.length === 0 ) delete re_top.siblings
        if ( re_top.subs && (re_top.subs.length === 0) ) delete re_top.subs    
    }
    if ( top.siblings && top.siblings.length === 0 ) delete top.siblings
    if ( top.subs && (top.subs.length === 0) ) delete top.subs
    return index
}


function r_lift_ordering(tree) {
    //
    if ( tree.depth === undefined ) return
    //
    tree.ordering = false
    if ( tree.siblings ) {
//
        let n = tree.siblings.length
        let removals = []
        for ( let i = 0; i < n; i++ ) {
            let sib = tree.siblings[i]
            console.log(sib.sect)
            if ( sib.type === 'order' ) {
                removals.push(i)
                if ( tree.ordering ) {
                    if ( Array.isArray(tree.ordering) ) {
                        tree.ordering.push(sib)
                    } else {
                        tree.ordering = [tree.ordering,sib]
                    }
                } else tree.ordering = sib
            }
        }
        removals.reverse()
        for ( let r of removals ) {
            tree.siblings.splice(r,1)
        }
        //
    }
    if ( tree.siblings && tree.siblings.length ) {
        for ( let sib of tree.siblings )
        r_lift_ordering(sib)
    }
    if ( tree.subs && tree.subs.length ) {
        for ( let sub of tree.subs )
        r_lift_ordering(sub)
    }
    if ( tree.siblings && (tree.siblings.length === 0) ) delete tree.siblings
}


function r_lift_siblings(top) {
    if ( Array.isArray(top.subs) && (top.subs.length > 0) ) {
        let subs_rewrite = []
        for ( let sub of top.subs ) {
            subs_rewrite.push(sub)
            if ( Array.isArray(sub.siblings) && (sub.siblings.length > 0) ) {
                subs_rewrite = subs_rewrite.concat(sub.siblings)
                delete sub.siblings
            }
        }
        top.subs = subs_rewrite
        for ( let sub of top.subs ) {
            r_lift_siblings(sub)
        }
    } else if ( top.subs !== undefined ) {
        delete top.subs
    }
}


function r_raise_ordering(tree,parent_id) {
    if ( !(tree.sub) && tree.top ) {
        tree.ordering = tree.top.ordering
        if ( tree.sect === tree.top.sect ) {
            tree.top.sect = tree.ordering.sect
        }
        tree.ordering.parent = parent_id
        r_raise_ordering(tree.top,tree.top.sect)
    } else if ( tree.subs && Array.isArray(tree.subs) ) {
        //
        tree.ordering = tree.subs.map( sub => sub.ordering ).filter( sub => (sub !== false) )
        if ( tree.ordering.length === 1) {
            tree.ordering = tree.ordering[0]
            tree.ordering.parent = parent_id
        } else if ( tree.ordering.length > 0 ) {
            for ( let ord of tree.ordering ) {
                ord.parent = parent_id
            }
        } else delete tree.ordering
        //
        for ( let sub of tree.subs ) {
            r_raise_ordering(sub,tree.sect)
        }
        //
    } else {
        if ( Array.isArray(tree.ordering) && tree.ordering.length === 0 ) delete tree.ordering
        if ( tree.ordering === false ) delete tree.ordering
    }
}



function r_found_ordering_and_mapify(tree) {

    if ( tree.subs && Array.isArray(tree.subs) && tree.subs.length > 0 ) {
        let sub_map = {}
        let found_order = []
        let sect_name_standin = tree.sect
        let j = 0;
        for ( let sub of tree.subs ) {
            if ( sub ) {        // just in case
                let sub_name = sub.sect
                if ( !(sub_name) || (sub_name.length === 0) ) {
                    sub_name = `${sect_name_standin}_${j}`
                }
                j++
                found_order.push(sub_name)
                sub_map[sub_name] = sub
                //
                r_found_ordering_and_mapify(sub)    
            }
        }
        tree.found_order = found_order
        tree.sub_map = sub_map
        delete tree.subs
    }

}



function r_mapify_ordering_using_found(top) {
    let fo = top.found_order
    if ( fo == undefined ) return
    let reorder = []
    if ( !Array.isArray(top.ordering) && typeof top.ordering === 'object' ) {
        reorder = [top.ordering]
    } else if ( Array.isArray(top.ordering) ) {
        reorder = top.ordering
    }
    //
    let omap = {}
    let j = 0
    for ( let ob of reorder ) {
        if ( ob.sect ) {
            omap[ob.sect] = ob
        } else {
            let oname = `${top.sect}_${j++}`
            omap[oname] = ob
        }
        ob.order = casual_array_to_array(ob.line)
        delete ob.line
    }
    //
    for ( let ofield of fo ) {
        if ( !(omap[ofield]) ) {
            omap[ofield] = 'unspecified'
        }
    }
    let map_keys = Object.keys(omap)
    top.order_keys = map_keys
    top.order_map = omap
    delete top.ordering

    if ( top.sub_map ) {
        for ( let [ky,sub] of Object.entries(top.sub_map) ) {
            r_mapify_ordering_using_found(sub)
        }
    }

    let mm = top.sub_map
    delete top.sub_map
    top.subs = mm
}

function compile_cmd_line(line) {  // could be much more
    if ( line[0] === '=' ) {
        line = line.substring(1).trim()
    }
    return line + '\n'
}

function r_compile_pass_1(tree,joiners) {
    //
    if ( tree.subs && ( typeof tree.subs === 'object' ) ) {
        let order_pref = tree.order_keys
        let sub_joiners = { "last_type" : false, "joins" : [], "current_join" : null, "discard" : {} }
        for ( let subky of order_pref ) {
            let sub = tree.subs[subky]
            console.log(subky,sub !== undefined)
            if ( sub ) {
                r_compile_pass_1(sub,sub_joiners)
            }
        }
        tree.joiners = sub_joiners
    } else {
        let ctype = tree.type
        let join = true
        if ( joiners.last_type !== ctype ) {
            join = false
            joiners.last_type = ctype
        }
        switch( ctype ) {
            case "cmd" : {
                if ( !(join) ) {
                    joiners.current_join = { 
                        "type" : "script",
                        "content" : ""
                    }
                    joiners.joins.push(joiners.current_join)
                }
                jj = joiners.current_join
                if ( jj ) {
                    jj.content += compile_cmd_line(tree.line)
                }
                break;
            }
            default : {         // not very clear really
                if ( !(join) ) {
                    joiners.current_join = { 
                        "type" : "exec",
                        "source_type" : ctype,
                        "content" : []
                    }
                    joiners.joins.push(joiners.current_join)
                }
                jj = joiners.current_join
                if ( jj ) {
                    jj.content.push[tree.sect]
                }
            }
        }
    }

}


function check_sub_prop(top) {
    //
    let check = top.siblings ? top.siblings.map(s => s.type) : []
    console.log(top.depth,check)
    if ( check.indexOf('order') >= 0 ) {
        console.log(top.sect,"ORDER IN THE WRONG PLACE - siblings check_sub_prop")
        process.exit(0)
    }
    if ( top.subs ) check = top.subs.map(s => s.type)
    if ( top.subs ) console.log(check)
    if ( check.indexOf('order') >= 0 ) {
        console.log(top.subs.map(s => s.sect))
        console.log(top.sect,"ORDER IN THE WRONG PLACE - subs check_sub_prop")
        process.exit(0)
    }
    if ( top.subs ) {
        for ( let sub of top.subs ) {
            check_sub_prop(sub)
        }
    }
    //
}


function print_tree(tree,path,path_type) {
    //
    if ( tree.depth === undefined ) { console.log(tree); return }
    //
    console.log('---- ------ ------',path, " -- ", (path_type == 1) ? "sib" : "sub")
    console.log("pt - sect:: ",tree.depth,tree.type,": ",tree.sect)
    console.log(`pt - siblings(${tree.sect})`,tree.siblings ? tree.siblings.map(s => `${s.type}: ${s.sect}`) : [])
    console.log(`pt - subs(${tree.sect})`,tree.subs ? tree.subs.map(s => `${s.type}: ${s.sect}`) : [])
    if ( tree.siblings ) {
        for ( let sib of tree.siblings) print_tree(sib,`${path}.${sib.sect}`,1)
    }
    if ( tree.subs ) {
        for ( let sub of tree.subs) print_tree(sub,`${path}.${sub.sect}`,0)
    }
}

function print_tree_w_order(tree,path,path_type) {
    if ( tree.depth === undefined ) { console.log(tree); return }
    //
    console.log('---- ------ ------',path, " -- ", (path_type == 1) ? "sib" : "sub")
    console.log("pt - sect:: ",tree.depth,tree.type,": ",tree.sect)
    console.log(`pt - ordering(${tree.sect})`, Array.isArray(tree.ordering) ? tree.ordering.map(s => `${s.sect} :: ${s.line}`) : `${tree.ordering.sect} :: ${tree.ordering.line}` )

    console.log(`pt - subs(${tree.sect})`,tree.subs ? tree.subs.map(s => `${s.type}: ${s.sect}`) : [])
    if ( tree.siblings ) {
        for ( let sib of tree.siblings) print_tree_w_order(sib,`${path}.${sib.sect}`,1)
    }
    if ( tree.subs ) {
        for ( let sub of tree.subs) print_tree_w_order(sub,`${path}.${sub.sect}`,0)
    }
}

function subordinates_tree_builder(tree,ky) {
    let sect_list = tree.classified
    let depth = 0
    let index = 0
    build_tree(sect_list,index,depth)
    tree.top = tree.classified[0]
    delete tree.classified
    //                      r_ for recursive (just for this)
    r_lift_ordering(tree.top)
    r_lift_ordering(tree)
    if ( tree.ordering === false ) delete tree.ordering
    r_lift_siblings(tree.top)
    r_raise_ordering(tree,ky)
    r_found_ordering_and_mapify(tree.top)
    r_mapify_ordering_using_found(tree.top)
    //
//print_tree_w_order(tree.top,ky)
    return tree
}


function compile_pass_1(tree) {
    let joiners = { "last_type" : false, "joins" : [], "current_join" : null, "discard" : {} }
    r_compile_pass_1(tree.top,joiners)
    return tree
}




//
// chase_depth(content,depth)
//
function chase_depth(content,depth,key) {
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
    //
    let cmd_line = false
    if ( i > 0 ) {
        cmd_line = content.substring(0,i).trim()
        content = content.substring(i).trim()
        i = 0
    }
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
        top_ctrl._lines = lines.map(line => {
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
            if ( (top_ctrl[key][0] === '@') || (top_ctrl[key].substring(0,2) === '|<')  || (top_ctrl[key].substring(0,2) === '|>') ) {
                // console.log(key,top_ctrl[key])
            } else {
                top_ctrl[key] = top_ctrl[key].substring(1)
            }
            //
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
                    top_ctrl[key]._lines = lines.map(line => {
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
                top_ctrl[key]._lines = lines.length ? lines : undefined
                top_ctrl[key]._movers = movers.length ? movers : undefined
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




function process_exec_line(od_parts) {
    //
    let inserts = od_parts[0]
    let params = od_parts[1]
    let ins_parts = inserts.split('<')
    ins_parts.shift()
    ins_parts = trimmer(ins_parts)
    //
    let cmd_line = false
    //
    if ( ins_parts[0] === 'expect' ) {
        if ( ins_parts[1] === 'ssh' ) {
            let filespec = ins_parts[2]
            if ( filespec.substring(0,"file".length) === "file" ) {
                let fname = filespec.substring(4).trim()
                if ( fname[0] === '=' ) {
                    fname = fname.replace('=','').trim()
                }
                cmd_line = `expect ./expectpw-exec.sh ${params} ${fname} >> name_run.out`
            }
        }
    }

    return cmd_line
}



function command_processing(top,coalescer,key) {
    let cmd = top.cmd_line
    //
    let rest_lines = []
    if ( top._lines ) rest_lines = [].concat(top._lines)
    //
    let top_props = {}
    coalescer[key] = top_props
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    if ( cmd.indexOf('%file') > 0 ) {
        top_props.goal_type = 'file'
        top_props.coalesce  = false
    } else  if ( cmd.indexOf('%line') > 0  ) {
        top_props.goal_type = 'line'
    } else  if ( cmd.indexOf('%dir') > 0  ) {
        top_props.goal_type = 'dir'
        top_props.exec = top.ordering.map(ky => top[ky])
        console.dir(top,{ depth: null })
    } else  if ( cmd.indexOf('%mover') > 0  ) {
        top_props.goal_type = 'mover'
        top_props.exec = top._movers
    }
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    if ( cmd[0] === '@' ) {
        top_props.goal_spec = cmd
    }
    if ( top_props.goal_type == 'line' ) {
        top_props.goal_spec = "add-line"
    }
    if ( (cmd.substring(0,2) === '|<') && (top_props.goal_type == 'line') ) {
        if ( top_props.exec == undefined ) {
            top_props.exec = []
        }
        let line = cmd.split('|')
        line.shift()
        line = trimmer(line)
        top_props.exec.push(line)
    }
    //
    for ( let line of rest_lines ) {
        switch ( top_props.goal_type ) {
            case "file" : {
                if ( (line.indexOf(top_props.goal_type) > 0) ) {
                    let sat_index = line.indexOf("file=") + "file=".length
                    if ( sat_index > 0 ) {
                        let sat_val = line.substring(sat_index)
                        sat_val = popout(sat_val,'|').trim()
                        top_props.goal_satisfier = sat_val
                        //
                        if ( line.indexOf(':coalesce') > 0 ) {
                            top_props.coalesce = true
                            line = line.replace(':coalesce','')
                            if ( coalescer.share_files === undefined ) coalescer.share_files = {}
                            if ( coalescer.share_files[sat_val] === undefined ) coalescer.share_files[sat_val] = 0
                            coalescer.share_files[sat_val]++
                        }    
                    }

                    if ( line.substring(0,2) === '|<' ) {
                        if ( top_props.exec == undefined || test_mover ) {
                            top_props.exec = []
                        }
                        line = line.split('|')
                        line.shift()
                        line = trimmer(line)
                        top_props.exec.push(line)
                        top.master_exec_line = process_exec_line(line)
                    }
                }
                break
            }
            case "line" : {
                if ( top_props.exec == undefined ) {
                    top_props.exec = []
                }
                top_props.exec.push(line)
                break
            }
            case "dir" : {
                if ( top_props.exec == undefined ) {
                    top_props.exec = []
                }
                top_props.exec.push(line)
                break
            }
            default : {
                break
            }
        }
    }
}


function raise_properties(top,coalescer,key) {
    //
    if ( typeof top === "string" ) {
        return { "output" : top }
    }
    //
    if ( coalescer.path_list == undefined ) coalescer.path_list = []
    coalescer.path_list.push(key)
    //
    if ( top.cmd_line !== false && top.cmd_line !== undefined ) {
        let path_start_ky = key
        //
        command_processing(top,coalescer,path_start_ky)
    }
    // ---- ---- ---- ---- ---- ---- ---- ----
    //
    top.output = ""
    if ( Array.isArray(top.ordering) ) {
        for ( let act of top.ordering ) {
            let sub = top[act]
            sub = raise_properties(sub,coalescer,`${key}.${act}`)
            if ( typeof sub.master_exec_line === "string" ) {    // this order is important
                top.output += sub.master_exec_line
                if ( coalescer[`${key}.${act}`].coalesce ) {
                    let shared_key = popafter(key,'::')
                    if ( coalescer[shared_key] === undefined ) coalescer[shared_key] = { "did_coalesce" : true }
                    if ( coalescer[shared_key].output === undefined ) coalescer[shared_key].output = ""
                    coalescer[shared_key].output += sub.master_exec_line + "\n"
                    if ( coalescer.path_list.indexOf(shared_key) < 0 ) {
                        coalescer.path_list.push(shared_key)
                    }
                }
            } else if ( typeof sub.output === "string" ) {
                top.output += sub.output + '\n'
            }  
        }
    }
    //
    return top
}



function shared_parent(key) {
    let upkey = key
    if ( key.indexOf('::') ) {
        upkey = key.split('::')
        upkey = upkey[1]    
    }
    upkey = upkey.split('.')
    upkey.pop()
    upkey = upkey.join('.')
    return upkey
}


function parse_operations(opspec) {
    if ( opspec[0] === '@' ) {
        let ops = opspec.split('@')
        ops.shift()
        ops = trimmer(ops)
        let ops_descr = {}
        for ( let op of ops ) {
            let op_arg = op.split('=')
            op_arg = trimmer(op_arg)
            let ky = op_arg[0]
            ops_descr[ky] = op_arg[1]
        }
        return ops_descr
    }
    return opspec
}




//
confstr = eliminate_line_start_comments(confstr,'--')
confstr = eliminate_empty_lines(confstr)
confstr = eliminate_line_end_comments(confstr,'\\s+--')
//
let top_level = top_level_sections(confstr)

////
let preamble_obj = process_preamble(top_level.preamble)
let defs_obj = process_defs(top_level.defs)
let acts_obj = process_acts(top_level.acts,preamble_obj,defs_obj)
console.dir(preamble_obj)
//console.dir(defs_obj)
//console.log(JSON.stringify(defs_obj,null,2))
//console.dir(acts_obj)
//console.log(JSON.stringify(acts_obj,null,2))
//


//console.log(preamble_obj.prog.acts)


let coalescing = {
    "shared_satisfied" : {}
}
let actionable_tree = {}

for ( let ky of preamble_obj.prog.acts ) {
    let target = acts_obj[ky]
    if ( target.outputs !== undefined ) {
        for ( let [addr,output] of Object.entries(target.outputs) ) {
            //console.log(output)
            console.log("---------------------------")
            let tree = depth_line_classifier(output,addr,ky)
            tree = subordinates_tree_builder(tree,ky)
            //console.dir(tree,{ depth: null })
            tree = compile_pass_1(tree)
            console.dir(tree,{ depth: null })
            console.log("---------------------------")
            /*
            let top = chase_depth(output,1,addr)
            if ( top ) {
                let conententless = r_remove_field(top,'content')
                if ( ky  === 'web' ) {    // 
                    conententless = raise_properties(conententless,coalescing,`${addr}::${ky}`)
                    if ( actionable_tree[addr] == undefined ) {
                        actionable_tree[addr] = {}
                    }
                    actionable_tree[addr][ky] = conententless
                    //console.log(JSON.stringify(conententless,null,2))
                    //console.dir(conententless,{ depth: null })
                }
            }
            */
        }
    }
}





// ---- ---- ---- ---- ---- ---- ---- ---- ----
//
async function output_coalesced() {
    for ( let ky of coalescing.path_list ) {
        //console.log(ky)
        let operations = coalescing[ky]
        let kp = ky.split('::')
        let addr = ""
        let kp_parts = []
        let top = false  
        if ( kp.length > 1 ) {
            addr = kp[0]
            kp_parts = kp[1].split('.')
            top = actionable_tree[addr][kp_parts.shift()]    
        } else {
            addr = ""
            kp_parts = []
            if ( operations ) {
                console.dir(operations,{ depth: null })
                if ( operations.did_coalesce ) {
                    let fname = `${kp[0]}.sh`
                    fs.writeFileSync(`${g_out_dir_prefix}/${fname}`,operations.output)
                }
            }
    
        }
        console.log(top)
        if ( operations ) {
            for ( let sub of kp_parts ) {
                top = top[sub]
                if ( top.output ) {
                                                        // console.log(top.output)
                    if ( operations.goal_type === 'file' )  {
                        if ( operations.coalesce ) {
                            let fname = operations.goal_satisfier
                            if ( coalescing.shared_satisfied[fname] === undefined ) {
                                fs.writeFileSync(`${g_out_dir_prefix}/${fname}`,top.output)
                                coalescing.shared_satisfied[fname] = { 
                                    "count" : 1,
                                    "placement" : parse_operations(operations.goal_spec),
                                    "files" : {
                                        "master_exec" : `${shared_parent(ky)}.sh`,
                                        "remote_exec" : fname
                                    }
                                }
                            } else {
                                coalescing.shared_satisfied[fname].count++
                            }
                        } else {
                            let fname = operations.goal_satisfier
                            fs.writeFileSync(`${g_out_dir_prefix}/${addr}-${fname}`,top.output)
                        }
                    }
                }
                if ( operations ) {
                    console.dir(operations,{ depth: null })
                    if ( operations.did_coalesce ) {
                        let fname = `${kp[1]}.sh`
                        fs.writeFileSync(`${g_out_dir_prefix}/${fname}`,operations.output)
                    }
                }
            }
        }
    }
    
    console.dir(coalescing,{ depth: null })
}


console.log("----------------------------------")



async function run_file(bash_file) {
    /// yeah
}

// ----

async function finally_run() {
    //
    for ( let [ky,value] of Object.entries(coalescing.shared_satisfied) ) {
        console.log(ky,value)
        let placer = value.placement
        let source = placer.source.split('>')
    
        console.log(source)
        let start_dir = source[0]
        if ( start_dir === 'here' ) {
            start_dir  = g_out_dir_prefix
        }
        let dest_dir = source[2]
        console.log(dest_dir)
        console.log(preamble_obj.scope)
        if ( dest_dir in preamble_obj.scope ) {
            dest_dir = preamble_obj.scope[dest_dir]
            dest_dir = unpack_values_transform(dest_dir,'ifkey')
        }
    
        let act_list = []
        for ( let [key,file] of Object.entries(value.files) ) {
            if ( key !== 'master_exec' ) {
                let cmd = `${placer.method} ${start_dir}/${file} ${dest_dir}`
                act_list.push(cmd)    
            }
        }
        //
        if ( placer.exec ) {
            let executor = placer.exec
            let access_who = `${executor}_exec`
            let nearest_exec = value.files[access_who]
            let exec_loc = `${access_who}_loc`
            exec_loc = preamble_obj.scope[exec_loc]
            let cmd = `ssh \${${executor}.user}@\${${executor}.addr} < ${start_dir}/${nearest_exec}`
            cmd = unpack_values_transform(cmd,'ifkey')
            act_list.push(cmd)
            //
            let editable = fs.readFileSync(`${start_dir}/${nearest_exec}`).toString()
            let updated = `pushd ${exec_loc}\n${editable}\npopd`
            fs.writeFileSync(`${start_dir}/${nearest_exec}`,updated)
        }
        //
        console.log(act_list.join('\n'))
        //
        fs.writeFileSync('./next-exec.sh',act_list.join('\n'))
        await run_file('./next-exec.sh')
    }    
}


//finally_run()



// mkdir -p foo/bar/zoo/andsoforth
/*

*/
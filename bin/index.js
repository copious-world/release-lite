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

const xops = require('../lib/exec_ops')


const fs = require('fs')
const {FileOperations} = require('extra-file-class')
let fos = new FileOperations()



const IMP_RULE_MARKER = '&|.'
const OBJ_LIST_TYPE_MARKER = '(~!)'
const TABLE_ROW_COL_TYPE_MARKER = '(=)'
const START_OF_SECTION = '!>'
const END_OF_SECTION = '<!'
const IN_SECT_LINE_START = '!-'


/// sections are of these types: act, def, goals




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

function casual_array_lines_to_array(arr_lines) {
    arr_lines = arr_lines.trim()
    if ( arr_lines[0] === '[' ) {
        arr_lines = arr_lines.substring(1)
        arr_lines = arr_lines.substring(0,arr_lines.lastIndexOf(']'))
    }
    arr_lines = arr_lines.trim()
    arr_lines = arr_lines.split('\n')
    arr_lines = trimmer(arr_lines)
    arr_lines = arr_lines.filter( line => (line.length > 0) )
    return arr_lines
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

function process_var_stack(vars) {   // EDITING
    //
    let vmap = {}
    vars = strip_front(vars,'!')
    for ( let v of vars ) {
        let parts = v.split('=')
        parts = parts.map(v => { return v.trim() })
        let vname = parts[0]
        vname = vname.substring(0,vname.indexOf('>')).trim()
        vmap[vname] = parts[1]
    }
    //
    let fvs = {}
    for ( let [k,v] of Object.entries(vmap) ) {
        let frms =  all_var_forms(v)
        if ( Object.keys(frms).length > 0 ) {
            fvs[k] = frms
        }
    }
    //
    for ( let [k,vars] of Object.entries(fvs) ) {
        for ( let vr of Object.keys(vars) ) {
            let vrk = vr.replace('${','').replace('}','').trim()
            if ( vmap[vrk] !== undefined ) {
                vmap[k] = subst_all(vmap[k],vr,vmap[vrk])
            }
        }
    }
    //
    return vmap
}




function build_basic_graph(defs,graph_use) {
    //
    let bgraph = {
    }
    let max_depth = 0
    //
    defs = strip_front(defs,'!')
    defs = trimmer(defs)
    //
    for ( let ldef of defs ) {
        let node_to_sibs = ldef.split('->')
        node_to_sibs = trimmer(node_to_sibs)
        let node_name = node_to_sibs[0]
        let sibs = casual_array_to_array(node_to_sibs[1])
        let info = {}
        let depth = 1
        if ( bgraph[node_name] === undefined ) {
            bgraph[node_name] = { depth, info, sibs }
        } else {
            bgraph[node_name].sibs = sibs
            depth = bgraph[node_name].depth
        }
        //
        depth++
        if ( max_depth < depth ) max_depth = depth
        for ( let sib of sibs ) {
            if ( bgraph[sib] === undefined ) {
                let backrefs = [ node_name ]
                info = { depth, backrefs }
                bgraph[sib] = info 
            } else {
                bgraph[sib].backrefs.push(node_name)
            }
        }
    }
    //
    let its = max_depth
    let levels = []
    for ( let i = 0; i < its; i++ ) levels.push([])
    //
    for ( let [ky,node] of Object.entries(bgraph) ) {
        let i = node.depth
        levels[i-1].push(ky)
    }

    while ( levels.length > 1 ) {
        let level = levels.pop()
        let prev = levels[levels.length-1]
        if ( prev ) {
            for ( let nname of level ) {
                let ky = nname
                if ( ky.indexOf('.') > 0 ) {
                    ky = popout(ky,'.')
                }
                let def = bgraph[ky]
                if ( def === undefined ) continue
                for ( let brf of def.backrefs ) {
                    if ( prev.indexOf(brf) >= 0 ) {
                        prev.push(`${brf}.${nname}`)
                    }
                }
            }
        }
    }
    //
    let path_ref = {}
    let path_keys = levels[0]
    for ( let pky of path_keys ) {
        let path = pky.split('.')
        let depth = path.length
        let ref = path.pop()
        path_ref[pky] = `${ref}@${depth}`
    }
    //
    return [bgraph,path_ref,max_depth]
}

//bgraph[`${node_name}.${sib}`] = `@${depth}`


function process_preamble(preamble) {   // definite def and act section for first run subst and highest level sequence
    //
    let preamble_sections = preamble.split('!\n')

    let sections = {
        "scope" : "",
        "prog"  : "",
        "graph" : ""
    }
    //
    preamble_sections = strip_front(preamble_sections,'!')


    for ( let sect of preamble_sections ) {
        //
        let sectype = popout(sect,'>')
        //
        sect = sect.split('\n')
        sect = trimmer(sect)

        sect = strip_front(sect,'!')

        sect = sect.filter(line => (line.length > 0))
        //
        let type_line = sect.shift()
        //
        //
        switch ( sectype ) {
            case 'act' : {
                sections.prog = process_preamble_acts(sect[0])
                break
            }
            case 'def' : {
                 sections.scope = process_var_stack(sect)
                break
            }
            case 'graph' : {
                graph_use = popafter(type_line,':').trim()
                let [graph,path_ref,max_depth] = build_basic_graph(sect,graph_use)
                sections.graph = {
                    "use" : graph_use,
                    "max_depth" : max_depth,
                    "g" : graph,
                    "paths" :path_ref
                }
                break
            }
        }
        //
    }

    return sections
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
    ssh_def_str = ssh_def_str.replace(END_OF_SECTION,'')
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




// hosts.by_key.abbr
function attach_defs_to_graph(preamble,defs) {
    //
    let graph = preamble.graph.g
    for ( let [ky,obj] of Object.entries(defs.host.by_key.abbr) ) {
        if ( ky in graph ) {
            graph[ky].host = obj
            let addr = obj.addr
            let auth = defs.ssh[addr]
            graph[ky].auth = auth
        }
    }
    //
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
// -------------------------------------




function process_goals(goals_descr) {
    let host_goals = {}
    for ( let [host,mgoals] of Object.entries(goals_descr) ) {
        //
        let hgoals = {}
        host_goals[host] = hgoals
        let each_host_goals = mgoals.split(IN_SECT_LINE_START)
        each_host_goals.shift()
        //
        for ( let gsect of each_host_goals ) {
            let abbr = popout(gsect,'>')
            let gdescr = popafter(gsect,'>').trim()
            hgoals[abbr] = {}
            if ( gdescr[0] === '[' ) {
                let goal_facts = casual_array_lines_to_array(gdescr)
                hgoals[abbr].goal_facts = goal_facts
            }
        }    
    }

    return host_goals
}



// -------------------------------------
// -------------------------------------

//
// top_level_sections -- pull apart the sections that are used to setup tables, actions, and goals
// 
//
function top_level_sections(file_str) {
    //
    let preamble = false
    let defs = {}
    let acts = {}
    let goals = {}

    let parts = file_str.split(START_OF_SECTION)
    parts = trimmer(parts)   // clean it up

    for ( let p of parts ) {        // process the text enough to classify it as a type of section
        //
        p = p.replace(END_OF_SECTION,'')  // end of section not needed
        //
        // process the first line 
        let l1 = first_line(p)
        let rest_p = after_first_line(p)
        let lparts = l1.split(':')          // ':' 
        lparts = trimmer(lparts)    // first part is name, second part is type (articulations for subtype)

        if ( lparts.length == 2 ) {   // formed right
            let key = lparts[0]
            let maybe_def = lparts[1].substring(0,3)
            maybe_def = (maybe_def === 'goa') ? lparts[1].substring(0,lparts[1].indexOf('=')).trim() : maybe_def

            if ( (maybe_def == 'act') || (maybe_def == 'def') || (maybe_def == 'goals') ) {
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
                if ( maybe_def == 'goals' ) goals[key] = rest_p.trim()
            }
        } else {        // something else ... not being classified (special app?)
            preamble = p
        }
    }

   
    return { preamble, defs, acts, goals }
}







function associate_final_state_goal_with_machines(running,graph) {
    //
    for ( let [ky,g] of Object.entries(running) ) {
        let machine = graph[ky]
        if ( machine ) {
            graph[ky].final_state = g
        }
    }
    //
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
                            case '>' : { ltype = 'sender'; break; }
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
            //console.log(sib.sect)
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

// -- 
function parse_exec_parameters(params_e,exec) {
    //
    if ( exec.controller === 'ssh' ) {
        let p_parts = params_e.split(' ')
        p_parts = trimmer(p_parts)
        params_e = {
            "pass" : p_parts[0],
            "user" : p_parts[1],
            "addr" : p_parts[2]
        }
    }
    //
    return params_e
}


function compile_placer_line(line) {
    //
    let line_parts = line.split('|')
    line_parts = trimmer(line_parts)
    let mover_part = line_parts[0] ? line_parts[0] : false
    let param_part = line_parts[1] ? line_parts[1] : false
    let exec_part = line_parts[2] ? line_parts[2] : false
    let exec_param_part = line_parts[3] ? line_parts[3] : false
    let script_lines = line_parts[4] ? line_parts[4] : false
    //
    if ( param_part[0] === '<' ) {
        script_lines = exec_param_part
        exec_param_part = exec_part
        exec_part = param_part
        param_part = ""
    }
    //
    if ( script_lines[0] === '=' ) {
        script_lines = script_lines.substring(1)
    }
    //
    let placer = {
        "sender" : mover_part,
        "params_m" : param_part,
        "exec" : exec_part,
        "params_e" : exec_param_part,
        "script" : script_lines
    }
    //
    if ( placer.params_e ) {
        placer.exec = compile_exec(placer.exec)
        placer.params_e = parse_exec_parameters(placer.params_e,placer.exec)
    }
    //
    return placer
}


function compile_overt_mover_line(line,joiner) {
    // ----
    if ( typeof line !== "string" ) {
        console.log(line)
        return line
    }
    //
    let host_hops = joiner.sender.path.path
    host_hops = host_hops.filter(h => (h[0] !== '%'))
    let dest = host_hops[host_hops.length-1]
    let src = host_hops[0]
    let hop_over = false
    //
    if ( (src === 'here' && dest === 'remote') || (src === 'remote' && dest === 'here') ) {
        hop_over = 'master'
    }

    line = line.substring(2).trim()
    let sender = line
    if ( line.indexOf('->>') > 0 ) {
        let [from,to] = line.split('->>')
        sender = {
            "from" : from.trim(),
            "to" : to.trim(),
            "source" : src,
            "hop_over" : hop_over,
            "dest" : dest,
            "direction" : "up"
        }
    } else if ( line.indexOf('->') > 0 ) {
        let [from,to] = line.split('->')
        sender = {
            "from" : from.trim(),
            "to" : to.trim(),
            "source" : src,
            "hop_over" : hop_over,
            "dest" : dest,
            "direction" : "up"
        }
    } else if ( line.indexOf('<<-') > 0 ) {
        let [to,from] = line.split('<<-')
        sender = {
            "from" : from.trim(),
            "to" : to.trim(),
            "source" : src,
            "hop_over" : hop_over,
            "dest" : dest,
            "direction" : "down"
        }
    } else if ( line.indexOf('<-') > 0 ) {
        let [to,from] = line.split('<-')
        sender = {
            "from" : from.trim(),
            "to" : to.trim(),
            "source" : src,
            "hop_over" : hop_over,
            "dest" : dest,
            "direction" : "down"
        }
    }
    //
    sender.from = sender.from.replace('://',':/')
    sender.to = sender.to.replace('://',':/')
    //
    return sender
}



function r_compile_pass_1(tree,joiners) {
    let ctype = tree.type
    let join = true
    if ( joiners.last_type !== ctype ) {
        join = false
        joiners.last_type = ctype
    }
    switch( ctype ) {
        case "sect" : {
            break
        }
        case "cmd" : {          // e.g a bash command
            if ( !(join) ) {
                joiners.current_join = { 
                    "type" : "script",
                    "content" : ""
                }
                joiners.joins.push(joiners.current_join)
            }
            let jj = joiners.current_join
            if ( jj ) {
                jj.content += compile_cmd_line(tree.line)
                //
                joiners.discard[tree.sect] = '0'
            }
            break;
        }
        case "sender" : {
            tree.sender = compile_overt_mover_line(tree.line,joiners)
            delete tree.line
            if ( !(join) || !(joiners.current_join) ) {
                joiners.current_join = { 
                    "type" : "exec",
                    "source_type" : ctype,
                    "content" : []
                }
                joiners.joins.push(joiners.current_join)
            }
            let jj = joiners.current_join
            jj.content.push(tree.sect)
            break
        }
        case "placer" : {
            tree.operations = compile_placer_line(tree.line)
            tree.operations.sender = compile_mover(tree.operations.sender)
            delete tree.line
        }
        default : {         // not very clear really
            if ( !(join) || !(joiners.current_join) ) {
                joiners.current_join = { 
                    "type" : "exec",
                    "source_type" : ctype,
                    "content" : []
                }
                joiners.joins.push(joiners.current_join)
            }
            let jj = joiners.current_join
            jj.content.push(tree.sect)

        }
    }
    //
    if ( tree.subs && ( typeof tree.subs === 'object' ) ) {
        let order_pref = tree.order_keys
        let sub_joiners = { "last_type" : false, "joins" : [], "current_join" : null, "discard" : {} }
        if ( tree.operations && (typeof tree.operations.sender === 'object') ) {
            sub_joiners.sender = tree.operations.sender
        }
        for ( let subky of order_pref ) {
            let sub = tree.subs[subky]
            //console.log(subky,sub !== undefined)
            if ( sub ) {
                if ( sub.addr === undefined ) sub.addr = tree.addr
                r_compile_pass_1(sub,sub_joiners)
            }
        }
        tree.joiners = sub_joiners
        //
        if ( Object.keys(sub_joiners.discard).length > 0  ) {
            for ( let subky of Object.keys(sub_joiners.discard) ) {
                tree.subs[subky].deleted = true
            }
        }
    }
    //
}


// ----


function r_handle_discards(tree) {
    if ( tree.subs ) {
        for ( let sub of Object.values(tree.subs) ) {
            if ( sub ) {
                r_handle_discards(sub)
                if ( sub.joiners && (typeof sub.joiners.discard === 'object') ) {
                    //
                    for ( let subky of Object.keys(sub.joiners.discard) ) {
                        delete sub.subs[subky]
                    }
                    //
                    if ( Object.keys(sub.subs).length === 0 ) {
                        delete sub.subs
                    }
                }   
            }
        }    
    }
}



// ----






function compile_exec(exec_line) {
//console.log("EXEC LINE: ",exec_line)
    let exln_descr = {}
    if ( exec_line[0] === '<' ) {  // regular cmd
        exec_line = exec_line.substring(1).trim()
        let incl_path = exec_line.split('<')
        incl_path = trimmer(incl_path)
        exln_descr.runner = incl_path[0]
        exln_descr.controller = incl_path[1]
        exln_descr.script = incl_path[2]
        //
        if ( exln_descr.script ) {
            let script = exln_descr.script
            if ( script.indexOf('file=') === 0 ) {
                exln_descr.goal = 'file'
                exln_descr.goal_sat = script.replace('file=','').trim()
            } else if ( script.indexOf('%') === 0 ) {
                exln_descr.coalesce = false
                exln_descr.goal = script.substring(1).trim()
                if ( exln_descr.runner.indexOf(':coalesce') > 0 ) {
                    exln_descr.runner = exln_descr.runner.replace(':coalesce','')
                    exln_descr.coalesce = true
                }
                //
                //
            }
        }
        //
    } else if ( exec_line[0] === '>' ) {  // sender
        //
        exec_line = exec_line.substring(1).trim()
        let expath = exec_line.split('->')
        expath = trimmer(expath)
        //
        exln_descr.goal = 'sender'        // also a match type
        exln_descr.path = expath        // should translate keywords, etc.
        //
        if ( expath[1][0] === '>' ) {
            expath[1] = expath[1].substring(1).trim()
            exln_descr.augment = 'insert-master'
        }
        //
    } else {
        //console.log("COMPILE EXEC -- keep line",exec_line)
        exln_descr.line = exec_line  // might have something else
    }
    return exln_descr
}


function r_operations_execs_and_movers(tree) {
    //
    if ( tree.operations && tree.operations.exec && (typeof tree.operations.exec === 'string') ) {
        tree.operations.exec = compile_exec(tree.operations.exec)   // if not string, this has been parsed already
        // console.dir(tree.operations.exec)
    }
    if ( tree.joiners ) {
        delete tree.joiners.current_join
        // console.dir(tree.joiners)
    }
    //
    if ( tree.subs && ( typeof tree.subs === 'object' ) ) {
        for ( let sub of Object.values(tree.subs) ) {
            r_operations_execs_and_movers(sub)
        }
    }
    //
}

/*
'@exec=master<here @path=here>%file>master_loc @method=scp'
'@exec=remote'
'@exec=master @path=here>%sender>master_loc>remote @method=scp'
'@exec=remote'
'@exec=remote'
*/

const g_g_types = [ '%line', '%file', '%dir', '%sender' ]
function is_goal_type(sp) {
    return (g_g_types.indexOf(sp) >= 0)
}

function compile_mover_source(src_str) {
    //
    let src_parts = src_str.split('>')
    src_parts = trimmer(src_parts)
    let mover_descr = {}
    mover_descr.path = src_parts
    for ( let sp of src_parts ) {
        if ( sp[0] === '%' ) {
            if ( is_goal_type(sp) ) {
//console.log("compile_mover_source ---------------",sp)
                mover_descr.goal = sp.substring(1)
            }
        }
    }
    //
    return mover_descr
}

// complile_mover_exec  -- handles @exec
//
//
function complile_mover_exec(src_str) {   // ultimately, the location of scripts and data come from this noodle
    //
    let src_parts = src_str.split('<')
    src_parts = trimmer(src_parts)
    let exec_descr = {
        "terminus" : "remote",
        "auth_expect" : "master",
        "controller" : "here"
    }
    //
    //
    if ( src_parts[0] === "master" ) {
        exec_descr.terminus = "master"
        if ( src_parts[1] === "here" ) {
            exec_descr.dir = g_out_dir_prefix
        } else {
            exec_descr.dir = "${asset_stager}"
        }
    }

    if ( src_parts[0] === "here" ) {
        exec_descr.terminus = "here"
        exec_descr.auth_expect = "here"
    }
    let epath = Object.values(exec_descr)
    exec_descr.exec_path = epath.reverse()
    //
    return exec_descr
}


function compile_mover(sender) {
    if ( typeof sender !== 'string' ) return sender
    //
    let components = sender.split('@')
    components.shift()
    components = trimmer(components)
    //
    let move_descr = {}
    //
    for ( let comp of components ) {
        let [ctype,value] = comp.split('=')
        ctype = ctype.trim()
        value = value.trim()
        move_descr[ctype] = value
        if ( ctype === 'script' || ctype === 'subject'  || ctype === 'move' ) {
            move_descr.goal = (value[0] === '%') ? value.substring(1) : value
        } else if ( ctype === 'path' ) {
            move_descr[ctype] = compile_mover_source(value)
            if ( move_descr[ctype].goal ) {
                move_descr.goal = move_descr[ctype].goal
                delete move_descr[ctype].goal
            }
        } else if ( ctype === 'exec' ) {
            move_descr[ctype] = complile_mover_exec(value)
            if ( move_descr[ctype].exec_path ) {
                move_descr.exec_path = move_descr[ctype].exec_path
                delete move_descr[ctype].exec_path
            }
        }
    }
    //
    return move_descr
}



function r_breadcrumbs_and_addresses(tree,addr,breadcrumb,bc_map) {
    tree.breadcrumb = `${breadcrumb}|${tree.sect}`
    if ( !( bc_map[tree.breadcrumb] ) ) {
        bc_map[tree.breadcrumb] = [addr]
    } else {
        bc_map[tree.breadcrumb].push(addr)
    }
    //
    if ( tree.subs ) {
        for ( let sub of Object.values(tree.subs) ) {
            r_breadcrumbs_and_addresses(sub,addr,tree.breadcrumb,bc_map)
        }
    }
}


function r_operation_movers(tree) {
    //
    if ( tree.operations && tree.operations.sender ) {
        tree.operations.addr = tree.addr
        tree.operations.sender = compile_mover(tree.operations.sender)
        //console.dir(tree.operations.sender)
        if ( tree.operations.sender && tree.operations.sender.goal ) {
            tree.operations.goal = tree.operations.sender.goal
            delete tree.operations.sender.goal
        }
        if ( tree.operations.exec && tree.operations.exec.goal ) {
            if ( tree.operations.goal ) {
                let g = tree.operations.exec.goal
                if ( tree.operations.goal !== g ) {
                    tree.operations.goal += `,${g}`
                    tree.operations.goal_conflict = true
                }
                delete tree.operations.exec.goal
            } else {
                tree.operations.goal = tree.operations.exec.goal
                delete tree.operations.exec.goal
            }

            if ( tree.operations.exec.runner ) {
                let ter = tree.operations.exec.runner
                if ( (typeof ter === 'string') && (ter.indexOf(':') > 0) ) {
                    let rparts = ter.split(':')
                    tree.operations.exec.runner = rparts[0]
                    let directive = rparts[1]
                    tree.operations[directive] = true
                }
            }
        }
    }
    //
    if ( tree.subs && ( typeof tree.subs === 'object' ) ) {
        for ( let sub of Object.values(tree.subs) ) {
            r_operation_movers(sub)
        }
    }
}



function prepare_remote_file(tree,actionable_tree) {
    //
    let operations = tree.operations
    let out_dir = operations.sender.exec.dir
    let file_name = operations.exec.goal_sat
    if ( out_dir === undefined ) {
        out_dir = g_out_dir_prefix
    }
    //
    if ( tree.joiners && tree.joiners.joins ) {
        for ( let join of tree.joiners.joins ) {
            let file_diff = operations.params_e
            //
            if ( typeof file_diff === 'string' ) {
                file_diff = file_diff.split(' ')
                file_diff = file_diff[file_diff.length-1]       // assume last par an addr....     
            } else {
                file_diff = file_diff.addr
            }
            if ( join.type === 'script' ) {
                let at_file = actionable_tree.files[file_name]
                if ( at_file === undefined ) {
                    at_file = {}
                    actionable_tree.files[file_name] = at_file
                    at_file.breadcrumb = tree.breadcrumb
                }
                if ( !(operations.coalesce) ) {
                    at_file[file_diff] = {}
                    at_file = at_file[file_diff]
                    file_name = `${file_diff}_${file_name}`
                }
                at_file.out_path = `${out_dir}/remote/${file_name}`
                at_file.script = join.content
            }
        }
    }
    //
}


function prepare_line(tree,actionable_tree) {

    let line_key = tree.breadcrumb
    line_key = subst_all(line_key,'|','_')

    let sectl = actionable_tree.lines[line_key]
    //
    if ( sectl === undefined ) {
        sectl = {}
        actionable_tree.lines[line_key] = sectl
        sectl.addrs = {}
        sectl.breadcrumb = tree.breadcrumb
    }
    //
    if ( sectl.tree === undefined ) {
        sectl.tree = tree
        sectl.locus = tree.operations.sender.exec.terminus
        sectl.exec = tree.operations.sender.exec
    }

    let ops = tree.operations
    let addr = ops.params_e.addr
    if ( addr ) {
        let comp_line = `${ops.exec.controller} ${ops.params_e.user}@${addr}  \'${ops.script}\'`
        if ( ops.exec.coalesce ) {
            sectl.coalesce = true
            if ( sectl.content === undefined ) sectl.content = ""
            sectl.content += '\n' + comp_line
            sectl.addrs[addr] = {
                "pass" : ops.params_e.pass
            }    
        } else {
            sectl.addrs[addr] = {
                "content" : comp_line,
                "pass" : ops.params_e.pass
            }    
        }
    }
}



function prepare_mover(tree) {
    return tree.sender
}


function parse_move_params(epars) {
    if ( typeof epars !== 'string' ) return epars
    //
    epars = epars.split(' ')
    epars = trimmer(epars)
    let separe = {
        "pass" : epars[0],
        "user" : epars[1],
        "addr" : epars[2],
    }
    return separe
}



let machine_stops = ['here','master','remote']






// capture_actionable_type_and_goal
//      build the actionable_tree ... use GOAL TYPE to identify the snippets of code and where they should go
//      -- breadcrumbs will have already been created.

function capture_actionable_type_and_goal(tree,top,actionable_tree,sect_type,goal_type) {
    //
    if ( tree.type === sect_type ) {
        if ( tree.operations && (tree.operations.goal === goal_type) ) {
            if ( sect_type == 'placer' ) {
                switch ( goal_type ) {
                    case 'file' : {
//console.log("MAKING FILES: ")
                        if ( actionable_tree.files === undefined ) {
                            actionable_tree.files = {}
                        }
                        prepare_remote_file(tree,actionable_tree)
                        break;
                    }
                    case 'line' : {
                        if ( actionable_tree.lines === undefined ) {
                            actionable_tree.lines = {}
                        }
                        prepare_line(tree,actionable_tree)
                        break;
                    }
                    case 'sender' : {
//console.dir(tree,{ depth: null })
                        break;
                    }
                }
            }
        } else if ( (tree.operations === undefined) && (sect_type === 'sender') ) {
            if ( actionable_tree.seek === undefined ) actionable_tree.seek = {}
            if ( typeof tree.sender === 'object' ) {
                tree.goal = "move"
                actionable_tree.seek[tree.sect] = {
                    "satisfied" : false,
                    "sender" : prepare_mover(tree)
                }    
            }
        }
    }
    //
    if ( tree.subs && ( typeof tree.subs === 'object' ) ) {
        for ( let sub of Object.values(tree.subs) ) {
            capture_actionable_type_and_goal(sub,top,actionable_tree,sect_type,goal_type)
        }
        // SEEK has been defined for a PLACER type of element
        if ( ( actionable_tree.seek !== undefined ) && ( tree.type === 'placer' )  ) {

            if ( actionable_tree.all_movement === undefined ) actionable_tree.all_movement = {}
            let ops = tree.operations
            //
            for ( let [ky_sect,sender] of Object.entries(actionable_tree.seek) ) {
                //
                let mpath = [].concat(ops.sender.path ? ops.sender.path.path : ops.sender.exec_path)
                let m_stops = [].concat(machine_stops)
                //
                let stop = m_stops.shift()
                while ( (mpath.indexOf(stop) < 0) && (m_stops.length)) {
                    stop = m_stops.shift()
                }
                if ( stop === undefined ) stop = "master"
                //
                sender.line = ""
                if ( sender.sender.hop_over !== false ) {
                    sender.master_line = ""
                }
                let addr = top.addr
//console.log("capture_actionable_type_and_goal: ",addr)
//console.log(sender)
                if ( tree.operations && tree.operations.sender ) {
                    if (  actionable_tree.all_movement[ky_sect] === undefined ) actionable_tree.all_movement[ky_sect] = {}
                    let bc = tree.breadcrumb + `|${ky_sect}`
                    actionable_tree.all_movement[bc] = actionable_tree.all_movement[ky_sect]
                    //
                    let a_moves = actionable_tree.all_movement[ky_sect]
                    let epars = ops.params_m
                    if ( epars !== false ) {
                        epars = parse_move_params(epars)
                        ops.params_m = epars
                        addr = epars.addr ?  epars.addr : addr
                    } else {
                        epars = ops.sender.exec_path
                    }
                    if (  a_moves[addr] == undefined ) {
                        a_moves[addr] = []
                    }
                    //
                    a_moves[addr].push(sender)
                    //
                    sender.path = [].concat(mpath)
                    let method = ops.sender.method
                    if ( method.indexOf('-r') === (method.length - 2) ) {
                        method = method.substring(0,method.indexOf('-r')) + ' -r'
                    }
                    if ( sender.sender.hop_over === false ) {
                        sender.line += `${method} ${sender.sender.from} ${sender.sender.to}`
                    } else {
                        let master_hop = preamble_obj.scope.master_stager
                        let asset_stager = preamble_obj.scope.asset_stager
                        sender.line += `${method} ${asset_stager} ${sender.sender.to}`
                        sender.master_line += `${method} ${sender.sender.from} ${master_hop}`
                    }
                    sender.locus = stop
                }
            }
            //
            delete actionable_tree.seek
        }
    }
    //
}


// --------------------------- --------------------------- ---------------------------
// --------------------------- --------------------------- ---------------------------

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

// --------------------------- --------------------------- ---------------------------
// --------------------------- --------------------------- ---------------------------


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


function compile_pass_1(tree,addr) {
    let joiners = { "last_type" : false, "joins" : [], "current_join" : null, "discard" : {} }
    if ( tree.top.addr === undefined ) tree.top.addr = addr
    r_compile_pass_1(tree.top,joiners)
    tree.joiners = joiners
    return tree
}

 

function handle_discards(tree) {
    r_handle_discards(tree.top)
    return tree
}





function operations_execs_and_movers(tree) {
    r_operations_execs_and_movers(tree.top)
    return tree
}




function operation_movers(tree) {
    r_operation_movers(tree.top)
    return tree    
}



function breadcrumbs_and_addresses(tree,addr,bc_map) {
    r_breadcrumbs_and_addresses(tree.top,addr,tree.sect,bc_map)
    return tree    
}


function capture_actionable(tree,actionable_tree) {
    capture_actionable_type_and_goal(tree.top,tree,actionable_tree,'placer','file')
    capture_actionable_type_and_goal(tree.top,tree,actionable_tree,'placer','line')
    capture_actionable_type_and_goal(tree.top,tree,actionable_tree,'placer','sender')
    capture_actionable_type_and_goal(tree.top,tree,actionable_tree,'sender',undefined)
    return tree
}




//
//  output_actionable_movement
//  
//      construct files that will handle the movement of assets from a creation place to a landing place
//


function interpret_mover_path(simplified_path,mover,direction) {

    /*
    console.log("interpret_mover_path - ")
    console.log(simplified_path)
    console.log("LOCUS: ", mover.locus)
    console.log("LINE: ", mover.line)
    console.log("MASTR LINE: ", mover.master_line,"\n")
    */

    let line_defs = []

    if ( mover.locus === 'here' ) {
        line_defs.push(['exec_loc',mover.locus,mover.line])
        if (  mover.master_line ) {
            line_defs.push(['arrow',mover.locus,mover.master_line])
        }
    } else if (  mover.locus === 'master' ) {
        line_defs.push(['exec_loc',mover.locus,mover.line])
        line_defs.push(['arrow',mover.locus,"password"])
    }

    if ( line_defs.length ) return line_defs

    return false
}





// output_actionable_movement
///
/// movement is part of the actionable tree

async function output_actionable_movement(all_movement) {
    //
    let node_files = {}
    for ( let [node_name,move_map] of Object.entries(all_movement) ) {
/*
console.log("output_actionable_movement -------------")
console.log(node_name)
console.dir(move_map,{ depth: null })
console.log("<------------- output_actionable_movement -------------")
*/
        //
        let files = {
            "addrs" : [],
            "file_map" : [],
            "paths" : {},
            "exec_loc" : {
                "here" : "",
                "master" : "",
                "remote" : ""
            },
            "arrow" : {
                "here" : "",
                "master" : ""
            }
        }

        node_files[node_name] = files

        //
        for ( let [addr,move_list] of Object.entries(move_map) ) {
            //
            files.addrs.push(addr)
            files.paths[addr] = {}
            //
            for ( let move of move_list ) {
                //
                let path = move.path
                files.paths[addr][move.sender.from] = path
                let simplified_path = path.filter( step => (step[0] !== '%') )
                //
                let dir_map = interpret_mover_path(simplified_path,move,move.sender.direction)
                //
                //
                if ( dir_map ) {
                    for ( let [direction,locus,line] of dir_map ) {
                        console.log(direction,locus,line)
                        files[direction][locus] += '\n' + line
                        let fname = `${g_out_dir_prefix}/${locus}/${direction}/moves-${node_name}.sh`
                        files.file_map[fname] = {
                            "path" : path
                        }
                    }
                }
            }
        }
        //
        for ( let direction of ["exec_loc","arrow"] ) {
            for ( let [loc,str] of Object.entries(files[direction]) ) {
                let fname = `${g_out_dir_prefix}/${loc}/${direction}/moves-${node_name}.sh`
                await fos.output_string(fname,str)
            }    
        }
    }  

    console.dir(node_files,{ depth : null })
}


// output_actionable_tree
// 
// output all files that will be used by execution sequencing... before sequencing execution
//
async function output_actionable_tree(actionable_tree) {
    //
    let file_map = actionable_tree.files
    if ( file_map ) {
        for ( let descr of Object.values(file_map) ) {
            if ( typeof descr.out_path === "string" ) {
                await fos.output_string(descr.out_path,descr.script)
            } else {
                for ( let descr_addr of Object.values(descr) ) {
                    await fos.output_string(descr_addr.out_path,descr_addr.script)
                }
            }
        }
    }
    //          remotes-to-master.sh        ----------   fix this
    //
    let lines = actionable_tree.lines
    if ( lines ) {
        let master_lines = ""
        for ( let [name,descr] of Object.entries(lines) ) {
    //console.log(name)
            if ( descr.coalesce ) {
                let fname = `${name}.sh`
                await fos.output_string(`${g_out_dir_prefix}/master/upload/expect-input-${fname}`,descr.content)
                master_lines += ` \nsend ssh expect-input-${fname} \n`
                for ( let [addr,info] of Object.entries(descr.addrs) ) {
                    cmd_line = `expect ./expect-just-pw-exec.sh ${info.pass} ${addr} ${fname} >> name_run.out`
                    master_lines += '\n' + cmd_line
                }
                descr.tree.operations.calling_line = `ssh \${master.user}@\${master.addr} 'bash -s' < ${g_out_dir_prefix}/master/here-arrow/expect-${name}.sh`
                await fos.output_string(`${g_out_dir_prefix}/master/here-arrow/expect-${name}.sh`,master_lines)
            } else {
                for ( let [addr,info] of Object.entries(descr.addrs) ) {
                    let fname = `${name}-${addr}.sh`
                    await fos.output_string(`${g_out_dir_prefix}/master/upload/${fname}`,info.content)
                    cmd_line = `expect ./expect-just-pw-exec.sh ${info.pass} ${fname} >> name_run.out`
                    master_lines += '\n' + cmd_line
                }
                descr.marked = "MARKED"
                descr.tree.operations.calling_line = `ssh \${master.user}@\${master.addr} 'bash -s' < ${g_out_dir_prefix}/master/here-arrow/expect-${name}.sh`
    //console.log("CALLING LINE ",name,descr.tree.operations.calling_line)
                await fos.output_string(`${g_out_dir_prefix}/master/here-arrow/expect-${name}.sh`,master_lines)    
            }
        }
    }

    // all movement
    if ( actionable_tree.all_movement ) {
        await output_actionable_movement(actionable_tree.all_movement)
    }

}



function r_sub_order_organize(tree,top_order,ky_path) {
    if ( tree.subs ) {
        for ( let o of tree.found_order ) {
            let sub = tree.subs[o]
            if ( !sub || sub.deleted ) continue
            if ( sub.operations && (typeof sub.operations.exec === 'object') ) {
                top_order.total.push(`${ky_path}|>${o}`)
                top_order.total_map[`${ky_path}|>${o}`] = sub.operations
                top_order.topper_map[`${ky_path}|>${o}`] = sub                    
            } else if ( sub.operations && (sub.operations.exec === false) && (sub.operations.goal === 'dir') ) {
                top_order.total.push(`${ky_path}|>${o}`)
                top_order.total_map[`${ky_path}|>${o}`] = sub.operations
                top_order.topper_map[`${ky_path}|>${o}`] = sub
                let msubs = sub.subs
                if ( msubs ) {
                    let filtered_subs = {}
                    for ( let [ky,musb] of Object.entries(msubs) ) {
                        if ( musb.goal === 'move' ) {
                            filtered_subs[ky] = musb.sender
                        }
                    }
                    sub.operations.movers = filtered_subs
                }
            }
            r_sub_order_organize(sub,top_order,`${ky_path}|>${o}`)
        }
    }
}


function sub_order_organize(exec_obj,top_order,ky_path) {
    let addr_tree_map = exec_obj
    //
    let addr_list = []
    let once = false
    for ( let [addr,sub_exec] of Object.entries(addr_tree_map) ) {
        addr_list.push(addr)
        if ( sub_exec && !once ) {
            once = true
            ky_path = `${ky_path}|>${sub_exec.tree.top.sect}`
            for ( let o of sub_exec.tree.top.found_order ) {
                let sub = sub_exec.tree.top.subs[o]
                if ( sub.operations && (typeof sub.operations.exec === 'object') ) {
                    top_order.total.push(`${ky_path}|>${o}`)
                    top_order.total_map[`${ky_path}|>${o}`] = sub.operations
                    top_order.topper_map[`${ky_path}|>${o}`] = sub                    
                } else if ( sub.operations && (sub.operations.exec === false) && (sub.operations.goal === 'dir') ) {
                    top_order.total.push(`${ky_path}|>${o}`)
                    top_order.total_map[`${ky_path}|>${o}`] = sub.operations
                    top_order.topper_map[`${ky_path}|>${o}`] = sub
                    let msubs = sub.subs
                    if ( msubs ) {
                        let filtered_subs = {}
                        for ( let [ky,musb] of Object.entries(msubs) ) {
                            if ( musb.goal === 'move' ) {
                                filtered_subs[ky] = musb.sender
                            }
                        }
                        sub.operations.movers = filtered_subs
                    }
                }
                if ( sub.deleted ) continue
                r_sub_order_organize(sub,top_order,`${ky_path}|>${o}`)
            }
        }
    }
    exec_obj.addrs = addr_list
    //
}



function upload_remotes_lines() {
    let master_loc = preamble_obj.scope.master_loc
    let master_user = preamble_obj.scope.master_user
    let master_exec_loc = preamble_obj.scope.master_exec_loc
    //
    let ensure_directories = `ssh ${master_user} 'mkdir -p ${master_exec_loc}'`
    let remote_absolute = `scp -r ${g_out_dir_prefix}/remote/* ${master_loc}`
    let master_resident = `scp -r ${g_out_dir_prefix}/master/upload/* ${master_loc}`
    //
    return ensure_directories + '\n' + remote_absolute + '\n' + master_resident
}


async function generate_target_file(target_file,remote_exec_file,ky) {
    let master_exec_loc = preamble_obj.scope.master_exec_loc
    let output =`pushd ${master_exec_loc}`
    //
    ky = ky.split('|>')

    let bc_key = ky.join('|')
    if ( !(breadcrumb_map[bc_key]) ) {
        ky.unshift(ky[0])
        bc_key = ky.join('|')
        if ( !(breadcrumb_map[bc_key]) ) return
    }

    if ( Array.isArray(breadcrumb_map[bc_key]) ) {
        let addrs = breadcrumb_map[bc_key]
        //
        for ( let addr of addrs ) {
            output += '\n'
            let pass = defs_obj.ssh[addr].pass
            let user = defs_obj.ssh[addr].user
            output += `expect expectpw-exec.sh '${pass}' ${user} ${addr} ${remote_exec_file}`
        }
        //
    }

    output += '\npopd'
    await fos.output_string(target_file,output)
}


async function finally_run() {
    let local_runner = upload_remotes_lines()
    //
    let master_user = preamble_obj.scope.master_user
    let master = defs_obj.host.master
    let master_assets = preamble_obj.scope.asset_stager
    //
    let vars = all_var_forms(master_user)
    for ( let vr of Object.keys(vars) ) {
        let mparts = vr.split('.')
        mparts = trimmer(mparts)
        let ky = mparts[1].replace('}','')
        let val = master[ky]
        master_user = subst_all(master_user,vr,val)
        local_runner = subst_all(local_runner,vr,val)
        master_assets = subst_all(master_assets,vr,val)
    }
    //
    //
    for ( let [ky,operations] of Object.entries(top_order.total_map) ) {
        local_runner += '\n'
        local_runner += '$%$%prepend'
        let prepend = `#${ky}   goal: ${operations.goal}`
        if ( operations.goal === 'file' ) {
            let goal_sat = operations.exec.goal_sat
            local_runner += '\n'
            let target_file = ''
            if ( operations.exec.coalesce ) {
                target_file = `${g_out_dir_prefix}/master/here-arrow/expect-${goal_sat}`
            } else {
                let kparts = ky.split('|>')
                target_file = `${g_out_dir_prefix}/master/here-arrow/expect-${kparts[0]}-${goal_sat}`
            }
            local_runner += `ssh ${master_user} 'bash -s'  < ${target_file}`
            // ----
            await generate_target_file(target_file,goal_sat,ky)
            prepend = prepend.replace('goal:','OK:')
        } else if ( operations.goal === 'sender' ) {
            let start = ""
            let next = ""
            let final = false
            //
            if ( operations.exec.augment === 'insert-master' ) {
                start = operations.exec.path[0]
                next = master_assets
                final = operations.exec.path[1]
            }
            //
            local_runner += '\n'
            local_runner += `scp -r ${start} ${next}`
            if ( final ) {
                let kparts = ky.split('|>')
                target_file = `${g_out_dir_prefix}/master/here-arrow/expect-${kparts[0]}-uploader.sh`
                local_runner += '\n'
                local_runner += `ssh ${master_user} 'bash -s'  < ${target_file}       # generate this file`
            }
            prepend = prepend.replace('goal:','OK:')
        } else if ( operations.goal === 'dir')  {
            let start = ""
            let next = ""
            //
            if ( operations.movers ) {
                //
                for ( let [mky,mover] of Object.entries(operations.movers) ) {
                    local_runner += '\n'
                    if ( mover.dest === 'master' ) {
                        start = mover.from
                        next = mover.to
                        local_runner += `scp -r ${start} ${next}`
                    } else if ( mover.dest === 'remote' ) {
                        start = mover.from
                        next = mover.to

                        let pass = defs_obj.ssh[operations.addr].pass
                        let mover_line = `expect-scp ${start} ${next} "${pass}"`   // pass is either ssh or key pass
                        local_runner += `ssh ${master_user} '${mover_line}'  # pass is either ssh or key pass`
                    }
                }
                //
            }
            //
            prepend = prepend.replace('goal:','OK:')
        } else if ( operations.goal === 'line')  {
            //
            let op_line = operations.calling_line
            if ( op_line ) {
                for ( let vr of Object.keys(vars) ) {
                    let mparts = vr.split('.')
                    mparts = trimmer(mparts)
                    let ky = mparts[1].replace('}','')
                    let val = master[ky]
                    op_line = subst_all(op_line,vr,val)
                }
                //
                local_runner += '\n'
                local_runner += op_line 
                prepend = prepend.replace('goal:','OK:')
            } else {
                local_runner += '\n'
                local_runner += `# ${operations.script} `
//console.log(ky,operations.script,operations)
            }
        }
        //
        local_runner = local_runner.replace('$%$%prepend',prepend)

    }
    
    //
    await fos.output_string(`${g_out_dir_prefix}/run_all.sh`,local_runner)
    //
}

//console.log(preamble_obj.prog.acts)



async function node_operations(node) {
    /*
    console.log("HOST:")
    console.dir(node,{ "depth" : null })
    if ( node.sibs ) console.log(node.sibs)
    else console.log("terminus")
    */
}

async function r_traverse_graph(graph,depth,max_depth,node_op) {
    if ( depth > max_depth ) return
    //
    let top_list = []
    let paths = graph.paths

    for ( let [path,node_depth] of Object.entries(paths) ) {
        let [ky,ndpth] = node_depth.split('@')
        ndpth = parseInt(ndpth)
        if ( ndpth == depth ) {
            top_list.push(path)
        }
    }
    //
    for ( let nky of top_list ) {
        let node_ky = graph.paths[nky]
        let nname = node_ky.split('@')[0]
        let node = graph.g[nname]
        //
        console.log("deleting",nname,nky)
        delete graph.g[nname]
        delete graph.paths[nky]
        //
        await node_op(node)
    }

}

async function traverse_graph(graph) {
    let base_graph = Object.assign({},graph)
    //
    base_graph.paths = Object.assign({}, base_graph.paths)
    base_graph.g = Object.assign({}, base_graph.g)
    //
    let max_depth = graph.max_depth
    let depth = 1
    //
    while ( depth <= max_depth ) {
        await r_traverse_graph(base_graph,depth,max_depth,node_operations)
        depth++
        console.log("GARPH")
        console.dir(base_graph,{ "depth" : null })
    }
    //
    //    console.dir(graph,{ "depth" : null })
    //
}



/*
'endpoint-users': {
    depth: 3,
    backrefs: [ 'home' ],
    final_state: { goal_facts: [] },
    host: {
        addr: '192.168.1.77',
        abbr: 'endpoint-users',
        host: '@home=LAN -- DietPi'
    },
    auth: { dns: '@home:LAN -- DietPi', user: 'root', pass: 'dietpi' }
},
*/

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
        let ops_ops64 = Buffer.from(ops).toString('base64')
        //
        // here->home  (hence home.pass, home.user, home.abbd) which is node.user, etc.
        //
        await xops.perform_expect_op(pass, user, addr, propagate_op, [`${abbr} ${preamble_obj.scope.master_exec_loc} ${g_hat_str64} ${ops64} ${ops_ops64}`])           
    }
    //
}



//  MAIN PROGRAM STARTS HERE

//
confstr = eliminate_line_start_comments(confstr,'--')
confstr = eliminate_empty_lines(confstr)
confstr = eliminate_line_end_comments(confstr,'\\s+--')
//
let top_level = top_level_sections(confstr)

////
let preamble_obj = process_preamble(top_level.preamble)
let defs_obj = process_defs(top_level.defs)
let goals_obj = process_goals(top_level.goals)

associate_final_state_goal_with_machines(goals_obj.running,preamble_obj.graph.g)


//
let acts_obj = process_acts(top_level.acts,preamble_obj,defs_obj)
//






// 
attach_defs_to_graph(preamble_obj,defs_obj)

let actionable_tree = {}
let top_order = {
    "partial" : {},
    "total" : [],
    "total_map" : {},
    "topper_map" : {}
}

let breadcrumb_map = {}


let exec_list = [].concat(preamble_obj.prog.acts)


// ----

for ( let ky of exec_list ) {
    let exec_obj = top_order.partial[ky]
    if ( exec_obj === undefined ) continue
    // top_order.total.push(ky)
    //
    sub_order_organize(exec_obj,top_order,ky)
}


///



/*
//console.dir(preamble_obj,{ depth: null })
//console.dir(goals_obj,{ depth: null })
//console.dir(defs_obj,{ depth: null })
//console.log(JSON.stringify(defs_obj,null,2))
//console.dir(acts_obj)
//console.log(JSON.stringify(acts_obj,null,2))

// ----
//console.log(top_order.total)
//console.dir(top_order,{ depth: null })
//console.dir(breadcrumb_map,{ depth: null })




for ( let ky of preamble_obj.prog.acts ) {
    let target = acts_obj[ky]
    if ( target === undefined ) continue
    top_order.partial[ky] = {}
    if ( target.outputs !== undefined ) {
        for ( let [addr,output] of Object.entries(target.outputs) ) {
            //console.log(output)
            console.log("---------------------------")
            let tree = depth_line_classifier(output,addr,ky)
            tree = subordinates_tree_builder(tree,ky)
            //console.dir(tree,{ depth: null })
            tree = compile_pass_1(tree,addr)
            tree = operations_execs_and_movers(tree)
            tree = operation_movers(tree)
            //tree = handle_discards(tree)
            tree = breadcrumbs_and_addresses(tree,addr,breadcrumb_map)
            tree = capture_actionable(tree,actionable_tree)
            //console.dir(tree,{ depth: null })
            console.log("---------------------------")
            top_order.partial[ky][addr] = {
                "tree" : tree,
                "partial" : {}
            }
            //
        }
    }
}
*/



// ----
(async () => {

//console.dir(goals_obj.running,{ depth: null })

    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    // console.log("--------------actionable_tree--------------------")
    //
    // await output_actionable_tree(actionable_tree)
    //
    // console.dir(actionable_tree,{ depth: null })
    //
    console.log("----------------------------------")
    await traverse_graph(preamble_obj.graph)
    console.log("----------------------------------")
    //
    // await finally_run()  // generate the final run script and submit it to our version of expect...
    //
})()




// mkdir -p foo/bar/zoo/andsoforth

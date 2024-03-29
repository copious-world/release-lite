#!/usr/bin/env node

// run distributed installation services over ssh
//
const {
    gen_repstr,
    iswhite,
    is_punctuated,
    strip_front,
    remove_spaces,
    popout,
    popafter,
    popout_match,
    popout_rest_match,
    popout_after_index,
    replace_eol,
    has_symbol,
    next_var_form,
    all_var_forms,
    trimmer,
    after_first_line,
    first_line,
    is_ipv6_at_first,
    is_octet_at_first,
    extract_all_keys,
    get_end_var_name,
    gulp_section,
    extract_object_field,
    subst_all,
    eliminate_line_start_comments,
    eliminate_line_end_comments,
    eliminate_empty_lines,
    clonify,
    table_to_objects,
    create_map_object,
    object_list_to_object,
    casual_array_to_array,
    casual_array_lines_to_array,
    r_remove_field,
    get_dot_val,
    pair_parts
} = require('../lib/utilities')

const {path_table} = require('../lib/figure_paths')


const {
    parameter_pop,
    popout_parameters,
    popout_var_of_var_form,
    pop_to_unbounded_space,
    is_binder,
    is_super_binder,
    parameter_is_binder,
    pop_selector,
    toplevel_split,
    get_type_specifier,
    form_subst,
    get_type_marker,
    var_from_selector,
    extract_selection_vars_of_param,

    print_tree,
    print_tree_w_order,

    has_optional_parameter_structure,
    is_conditional_value_assignment,
    pop_past_value_assigner,
    pop_var_producer,
    form_without_options,
    has_goal_structure,
    has_list_structure,
    has_selector_structure,
    has_selector_structure_parameter,

    is_subst_var_consumer,
    is_subst_dir_consumer,
    is_match_var_consumer,
    is_type_check,
    is_def_table_var,

    is_constant_yielding_form,
    is_unbounded_rule

} = require('../lib/parse-tools')


// https://github.com/cheng-zhao/libast

const Goal = require('../lib/goal')


const fs = require('fs')
const {FileOperations} = require('extra-file-class')
let fos = new FileOperations()



const IMP_RULE_MARKER = '&|.'
const OBJ_LIST_TYPE_MARKER = '(~!)'
const TABLE_ROW_COL_TYPE_MARKER = '(=)'
const START_OF_SECTION = '!>'
const END_OF_SECTION = '<!'
const IN_SECT_LINE_START = '!-'
const LOCAL_SUBST_START ='|-'
const LOCAL_SUBST_END ='-|'
const EOF_KEY = '>'

let preamble_obj = false
let defs_obj = false
let goals_obj = false
//

/// sections are of these types: act, def, goals





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

function process_var_stack(vars) {   // EDITING
    //
    let vmap = {}
    vars = strip_front(vars,'!')
    for ( let v of vars ) {
        let parts = v.split('=')
        parts = parts.map(v => { return v.trim() })
        let vname = parts[0]
        vname = vname.substring(0,vname.indexOf(EOF_KEY)).trim()
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
        let sectype = popout(sect,EOF_KEY)
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





// ---- all_directory_substitutions
function all_directory_substitutions(section_def,rest_sect_str) {
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


function local_text_substitutions_and_var_table(target_str) {
    let act_section = {}
    //
    let [sect_str,rest_sect] = gulp_section(target_str,LOCAL_SUBST_START,LOCAL_SUBST_END)
    //
    if ( sect_str ) {
        let fieldobj_list = sect_str.split(OBJ_LIST_TYPE_MARKER)   // use the field separations
        fieldobj_list = trimmer(fieldobj_list)
        for ( let fo of fieldobj_list ) {    // some number of substitution rules by field
            if ( fo.length ) {
                let [sect_key,sect_object] = extract_object_field(fo)
                act_section[sect_key] = sect_object   // this is now a replacement rule for the sections.
            }
        }
        //
        act_section = all_directory_substitutions(act_section,rest_sect)    // now do substitutions from the local subst rules
    } else {
        act_section.converted = target_str
    }

    return act_section
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
        //
        let act_section = local_text_substitutions_and_var_table(act_str)
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
                    let master = Object.assign({},defs_obj.host.master)
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
                                    ha = form_subst(ha,var_forms,vf_lookup,access,hh)
                                    addr_o_map[hh] = ha
                                }
                            }
                        } else {
                            let h_out = (tindex < 0) ? ("" + c_str) : ("" + string_parts[h])
                            h_out = form_subst(h_out,var_forms,vf_lookup,access,hh)
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

function subst_defs_in_scope_vars(preamble_obj,defs_obj) {
    //
    let scope_vars = preamble_obj.scope
    let h_abbr = defs_obj.host.by_key.abbr
    let ssh = defs_obj.ssh
    let master = defs_obj.host.master
    //
    for ( let [vname,vdef]  of Object.entries(scope_vars) ) {
        let vfrms = all_var_forms(vdef)
        for ( let v in vfrms ) {
            let path = v.substring(2,v.lastIndexOf('}')).trim()
            path = path.split('.')
            if ( path[0] === 'master' ) {
                let value = master[path[1]]
                if ( value === undefined ) {
                    value = ssh[master.addr][path[1]]
                }
                vdef = subst_all(vdef,v,value)
                scope_vars[vname] = vdef
            } else {
                let value = h_abbr[path[0]][path[1]]
                vdef = subst_all(vdef,v,value)
                scope_vars[vname] = vdef
            }
        }
    }
    //
}









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
            let abbr = popout(gsect,EOF_KEY)
            let gdescr = popafter(gsect,EOF_KEY).trim()
            hgoals[abbr] = {}
            if ( gdescr[0] === '[' ) {
                let goal_facts = casual_array_lines_to_array(gdescr)
                hgoals[abbr].goal_facts = goal_facts
            }
        }    
    }

    return host_goals
}


function get_rules_of_depths(rtext,depth) {
    let splitter = '\\!' + gen_repstr(depth,'-')
    splitter += '(?!-)'
    let rgx = new RegExp(splitter)
    let rules_of_depth = rtext.split(rgx)
    rules_of_depth.shift()
    rules_of_depth = trimmer(rules_of_depth)
    return rules_of_depth
}


function r_rule_tree_type_1(rtxt,depth) {
    let rule_stuct = {}
    let rky = first_line(rtxt)

    let subrtxrt = after_first_line(rtxt)
    if ( subrtxrt.length > 0 ) {
        let rule_items = get_rules_of_depths(subrtxrt,depth+1)
        if ( rule_items.length > 1 ) {
            let n = rule_items.length
            for ( let i = 0; i < n; i++ ) {
                let srtxt = rule_items[i]
                rule_items[i] = r_rule_tree_type_1(srtxt,depth+1)
            }
        }
        rule_stuct[rky] = rule_items    
    } else {
        rule_stuct[rky] = "one-line"
    }
    return rule_stuct
}


function parameter_to_binder(factoid) {
    let binder = {
    }
    let partxt = popout(popafter(factoid,'('),')')
    let par_list = toplevel_split(partxt,',')
    let b_vars = {
        "type" : "=",
        "selectors" : {}
    }
    for ( let param of par_list ) {
        if ( param.indexOf('->') > 0 ) {
            let parts = param.split('->')
            parts = trimmer(parts)
            let vr = parts[1]
            //
            let vals = parts[0]
            let [selector, rest ] = pop_selector(vals)
            vals = rest
            vals = vals.split('|')
            vals = trimmer(vals)
console.log(vals)
            if ( vals[0].indexOf(':') > 0 ) {           // for type specifier
                vals[0] = (vals[0].split(':'))[1].trim()
            }

            if (selector) {
                b_vars.type = "select"
                b_vars.selectors[selector] = ""
            }

            b_vars[vr] = vals
        }
    }
    binder[factoid] = b_vars
    return binder
}





function parse_var_producer(var_producer) {
    //
    let maybe_conditions = false
    let form_type = "block"
    var_producer = var_producer.trim()
    if ( (var_producer.indexOf('|') < 0) && (var_producer[0] === '(') ) {
        var_producer = var_producer.substring(1)
        var_producer = var_producer.trim()
        if ( (var_producer.lastIndexOf(')')+1) < var_producer.length ) {
            maybe_conditions = var_producer.substring(var_producer.lastIndexOf(')')+1)
        }
        var_producer = var_producer.substring(0,var_producer.lastIndexOf(')'))
        var_producer = var_producer.trim()
    }
    if ( var_producer.indexOf(',') > 0 || var_producer.indexOf('|') > 0  ) {
        let ast = {
            "code" : var_producer,
            "parts" : false
        }
        let splitter = var_producer.indexOf('|')
        let parts = ( splitter > 0) ? toplevel_split(var_producer,'|') : toplevel_split(var_producer,',')
        if ( splitter > 0 ) {
            form_type = "match"
        } else {
            form_type = "list"
        }
        parts = trimmer(parts)
        let vars = {}
        let ast_parts = []
        for ( let prt of parts ) {
            let [vrs,ast] = parse_var_producer(prt)
            vars = Object.assign(vars,vrs)
            ast_parts.push(ast)
        }
        ast.parts = ast_parts
        delete vars['@']
        //
        ast.vars = vars
        ast.f_type = form_type
        return [vars,ast]
    } else if ( var_producer.indexOf('(') > 0 ) {   // e.g. *(*)
        let ast = {
            "code" : var_producer,
            "parts" : false
        }
        ast.f_type = "call"

        let vars = {}
        let ast_parts = []

        let prt = var_producer.substring(var_producer.indexOf('('))
        let [vrs,s_ast] = parse_var_producer(prt)
        vars = Object.assign(vars,vrs)
        ast_parts.push(s_ast)

        ast.parts = ast_parts
        delete vars['@']
        ast.vars = vrs
        return [vars,ast]
    } else {
        form_type = "value"
        if ( var_producer.indexOf('=') > 0 ) {
            let v_parts = var_producer.split('=')
            v_parts = trimmer(v_parts)
            let vmp = {}
            vmp[v_parts[0]] = ""
            return [vmp,{ "default" : v_parts[1], "f_type" : form_type }]
        } else if ( (typeof maybe_conditions === 'string') && (maybe_conditions.indexOf('=>') == 0) ) {
            maybe_conditions = maybe_conditions.substring(2).trim()
            //
            let v_parts = maybe_conditions.split('=')
            v_parts = trimmer(v_parts)
            let vmp = {}
            vmp[v_parts[0]] = ""
            return [vmp,{ "code" : var_producer, "default" : v_parts[1], "vars" :  v_parts[0], "f_type" : form_type  }]
        }
        let vmp = {}
        vmp[var_producer] = ""
        return [vmp,var_producer]
    }
}


function pop_and_process_var_producer(code_src) {
    let [var_producer,restl] = pop_var_producer(code_src)
    let [vars,ast] = parse_var_producer(var_producer)
    return[vars,ast,restl]
}





function bind_goal_param(binder,code_src,val_src) {
    //
    let var_table = {
        "v_type" : "single"
    }
    //

    code_src = code_src.replace('->','').trim()
    let popped = gulp_section(val_src,'(',')')

    let [v_list,ast,rest_line] = pop_and_process_var_producer(code_src)

    let key = Object.keys(v_list).join(',')
    var_table.form = popped[0]
    var_table.ast = ast
    //
    binder.v_list = v_list
    //
    if (  binder[var_table.form] === undefined ) binder[var_table.form] = {}

    binder[var_table.form][key] = var_table
    return [binder,rest_line]

}



//  match_to_subgoals
// ---- ---- ---- ---- ---- ---- ----
// entry_subgoals -- these are all possible subgoals for each subg being passed (only some might match)
// p_binder
//
function match_to_subgoals(subg,entry_subgoals,p_binder) {
    //
    subg = subg.trim()
    let subg_searcher = popout(subg,'(').trim()
    let subgoals = []
    for ( let e_subg of entry_subgoals ) {
        let sg = Object.keys(e_subg)[0]
        if ( sg.indexOf(subg_searcher) === 0 ) {
            subgoals.push(e_subg)
        }
    }
    return subgoals
}





// subgoal_list_to_map
//
// all_stacks -- put splits onto all_stacks

function subgoal_list_to_map(subgoal_list,p_binder,stack,all_stacks) {
    let gmap = {}
    //
    for ( let entry of subgoal_list ) {
        //
        let ky = Object.keys(entry)[0]
        let popky = popout(ky,EOF_KEY)
        popky = remove_spaces(popky)
        if ( popky.indexOf('),') > 0 ) {
            popky = toplevel_split(popky,',')
        } else popky = [popky]
        //
        let entry_subgoals = entry[ky]

        for ( let gky of popky ) {

            // PATH PRUNING HERE....  -- just one case
            // choose the path belonging to the branch being evaluated  
            if ( /^.*\:[ABCDEFGHIJKLMNOPQRSTUVWXYZ]+\=.*/.test(gky) ) {
                let check_val = popafter(gky,'=')
                let binder_ky = gky.substring(gky.indexOf(':')+1,gky.indexOf('='))
                if ( !(Array.isArray(p_binder[binder_ky])) && (check_val !== p_binder[binder_ky]) ) continue
            }

            let after_piece = popafter(ky,EOF_KEY)
            after_piece = after_piece.trim()
            //

            let binder = {}
            let subgoals = ""
            if ( is_binder(after_piece) || is_super_binder(after_piece)  ) {
                let [binder_update,rest_line] = bind_goal_param(p_binder,after_piece,gky)
                if ( binder_update ) binder = binder_update
                if ( rest_line ) after_piece = rest_line
                else after_piece = ""
            }

            if ( (after_piece.length > 0)  && (entry_subgoals === 'one-line') ) {
                if ( after_piece.indexOf(',') > 0 ) {
                    if ( after_piece[0] === '[' ) {
                        after_piece = after_piece.substring(1)
                        after_piece = after_piece.substring(0,after_piece.lastIndexOf(']'))
                        after_piece = after_piece.trim()
                    }
                    subgoals = toplevel_split(after_piece,',')

                } else {
                    subgoals = [after_piece]
                }
            } else if ( (after_piece.length > 0) && Array.isArray(entry_subgoals) ) {
                // special case
                if ( after_piece.indexOf(',') > 0 ) {
                    subgoals = toplevel_split(after_piece,',')
                } else {
                    subgoals = [after_piece]
                }
                // after_piece is goal material before any depth increasing lines ... 
                // subgoals should be a map from these and anything in the subgoal that matches per atom
                let subgoal_map = {}
                for ( let subg of subgoals ) {
                    //
                    if ( parameter_is_binder(subg) ) {
                        binder = parameter_to_binder(subg)
                    } else {
                        binder = {}
                    }
                    //
                    let list_of_subgs = match_to_subgoals(subg,entry_subgoals,p_binder)
                    //
                    binder = Object.assign(p_binder,binder)
                    subgoal_map[subg] = {
                        binder,
                        subgoals : subgoal_list_to_map(list_of_subgs,binder,stack,all_stacks)
                    }
                    //
                }
                subgoals = subgoal_map
            }

            // this is not being called ... should it be?
            if ( typeof subgoals === 'string' ) {
console.log("subgoals is a string",subgoals)
                if ( Array.isArray(entry_subgoals) ) {
                    binder = Object.assign(p_binder,binder)
                    subgoals = subgoal_list_to_map(entry_subgoals,binder,stack,all_stacks)
                } else {
                    subgoals = entry_subgoals
                }
            }
            
            gmap[gky] = {
                binder,
                subgoals
            }
        }
    }

    return gmap
}


// process rules
//  convert the text representation of the rule definitions to rule objects
//  keep the hierarchy of the rules in place.
//  Handle odd rules. 



function check_for_var_producer(term) {
    //
    if ( term.indexOf('(') > 0 ) {
        let pars = popout(popafter(term,'('),')').trim()
        if ( pars.length ) {
            if ( pars.indexOf('->') > 0 ) {
                let v_producer = {}
                let p_list = toplevel_split(pars,',')
                for ( let i = 0; i < p_list.length; i++ ) {
                    let par = p_list[i]
                    if ( par.indexOf('->') > 0 ) {
                        let vparts = par.split('->')
                        vparts = trimmer(vparts)
                        let pvr = vparts[1]
                        let prod_part = vparts[0]
                        //
                        if ( has_selector_structure(prod_part) ) {
                            let selector_pair = pop_selector(prod_part)
                            let selections = selector_pair[1]
                            selections = toplevel_split(selections,'|')
                            v_producer[pvr] = {
                                "index" : (i+1),
                                "selections" : selections,
                                "source" : selector_pair[0]
                             }     
                        } else {
                            v_producer[pvr] = {
                                "index" : (i+1),
                                "source" : prod_part
                             }     
                        }

                    }
                }
                return v_producer
            }
        }
    }
    //
    return false
}


function unpack_vars_and_goals(line) {
    let var_intro = false
    let goals = []
    let goal_part = ""
    if ( line.indexOf('->') === 0 ) {
        line = line.replace('->','').trim()
        let [var_produder, restl] = pop_var_producer(line)
        var_intro = var_produder
        goal_part = restl
    } else {
        goal_part = line
    }
    //
    if ( has_goal_structure(goal_part) ) {
        let g_list = toplevel_split(goal_part,',')
        g_list = g_list.map( g_term => {
            let gpair = {}
            let v_producer = check_for_var_producer(g_term)
            gpair[g_term] = {
                "var_producer" : v_producer,
                "subs" : "terminus"
            }
            if ( v_producer  && (typeof v_producer === 'object') ) {
                for ( let [pky, prod] of Object.entries(v_producer) ) {
                    if ( prod.selections ) {
                        if ( gpair[g_term].var_consume === undefined ) gpair[g_term].var_consume = {}
                        gpair[g_term].var_consume[prod.source] = { 'v_type' : 'selector', 'output' :  pky }
                    }
                }
            }
            return gpair
        })
        goals = {
            "use" : "subgoals",
            "subs" : g_list
        }
    } else if ( has_list_structure(goal_part) ) {
        goals = {
            "use" : "p-list",
            "list" : casual_array_to_array(goal_part)
        }
    }
    return [var_intro,goals]
}


function marked_match(sub,marker) {
    let ky = Object.keys(sub)[0]
    if ( ky.indexOf(marker) === 0 ) return true
    return false
}



function is_var_consumer(rky)  {
    //
    if ( /^.*\(\..*\:.+\)/.test(rky) || /^.+\:.+\=/.test(rky) ) return true
    return false
}


function is_branch_select(rky) {
    if ( /^.+\:.+\=/.test(rky) ) return true
    return false
}

function is_type_filter(rky) {
    if ( /^.*\(\..*\:.+\)/.test(rky) ) return true
    return false
}


function map_rules_def_to_structure(dtable_rule) {
    for ( let [rdef,rsubs] of Object.entries(dtable_rule) ) {
        //
        let popky = popout(rdef,EOF_KEY)
        popky = remove_spaces(popky)
        if ( popky.indexOf('),') > 0 ) {
            popky = toplevel_split(popky,',')
        } else popky = [popky]
        //
        let after_piece = popafter(rdef,EOF_KEY)
        after_piece = after_piece.trim()
        //
        for ( let rky of popky ) {
            let subs = clonify(rsubs)
            dtable_rule[rky] = {
                "rest_line" : after_piece,
                "var_evals" : {},
                "subs" : subs
            }

            let further = dtable_rule[rky]

            //
            if ( is_var_consumer(rky) ) {
                if ( is_branch_select(rky) ) {
                    let vr = popout(popafter(rky,':'),'=')
                    let op = popout(rky,':')
                    let match = popafter(rky,'=').trim()
                    if ( further.var_consume === undefined ) further.var_consume = {}
                    //
                    further.var_consume[vr] = {
                        "type"  : "path-select",
                        "value" : match,
                        "goal_op" : op
                    }
                } else if ( is_type_filter(rky) ) {
                    let vr = popout(popafter(rky,':'),')')
                    let checker = popout(popafter(rky,'('),':')
                    if ( further.var_consume === undefined ) further.var_consume = {}
                    //
                    further.var_consume[vr] = {
                        "type"  : "file-type",
                        "check" : checker
                    }
                }
            }
            //
            if ( Array.isArray(subs) ) {
                for ( let sub of subs ) {
                    map_rules_def_to_structure(sub)
                }
            }
            //
            if ( further.rest_line.length ) {
                let [var_intro,subgoals] = unpack_vars_and_goals(further.rest_line)
                //
                further.var_producer = var_intro
                if ( ( typeof var_intro === "string" ) && (var_intro.indexOf('@') < 0) && (rky.indexOf('@') < 0 ) ) {
                    let var_val = popout_parameters(rky)
                    further.var_evals[var_intro] = var_val
                }

                //
                if ( subgoals.use == "p-list" ) {
                    further.p_list = subgoals.list
                } else if ( subgoals.use == "subgoals" ) {
                    if ( further.subs === 'one-line' ) {
                        further.subs = subgoals.subs
                    } else {
                        // merge goals....
                        let new_subs = []
                        //
                        let dominant = subgoals.subs
                        for ( let dsub_pair of dominant ) {
                            let dsubkey = Object.keys(dsub_pair)[0]
                            let dsubinfo = dsub_pair[dsubkey]
                            //
                            let marker = popout(dsubkey,'(')
                            let marked_subs = further.subs.filter( sub => (marked_match(sub,marker)) )
                            let other_subs = further.subs.filter( sub => (!marked_match(sub,marker)) )

                            //
                            if ( marked_subs.length ) {
                                if ( dsubinfo.subs === 'terminus' ) {
                                    dsubinfo.subs = marked_subs
                                } else if ( Array.isArray(dsubinfo.subs) ) {
                                    dsubinfo.subs = dsubinfo.subs.concat(marked_subs)
                                }
                                for ( let msub of marked_subs ) {
                                    msub.dominated = true
                                }
                                new_subs.push(dsub_pair)
                            } else {
                                new_subs.push(dsub_pair)
                            }
                            new_subs = new_subs.concat(other_subs)
                        }
                        further.subs = new_subs.filter(sub => !(sub.dominated))
                    }
                }
                //
            }
            delete further.rest_line
        }
        //
        delete dtable_rule[rdef]
    }
}




function last_pass_extract_var_consumers(dtable_rule) {
    if ( !(dtable_rule) ) return
    if ( typeof dtable_rule === "string" ) return
    for ( let [rdef,rsub] of Object.entries(dtable_rule) ) {
        if ( typeof rsub === "object" && rsub.subs ) {
            //console.log("last_pass_extract_var_consumers",rdef,rsub.var_consume,rsub.var_evals)
            if ( is_subst_var_consumer(rdef) ) {
                if ( rsub.var_consume === undefined ) rsub.var_consume = {}
                let vars = all_var_forms(rdef)
                for ( let kys in vars ) {
                    if ( is_subst_var_consumer(kys) ) {
                        let vr = popout_var_of_var_form(kys)
                        if ( vr.length === 0 ) {
                            console.log("ZERO LENGTH VAR ",kys)
                        } else {
                            if ( is_def_table_var(vr) ) {
                                rsub.var_consume[kys] = {
                                    "type" : "def-table",
                                    "value" : "?"
                                }
                            } else {
                                rsub.var_consume[vr] = {
                                    "type" : "value",
                                    "value" : "?"
                                }    
                            }
                        }
                    }
                }
            }
            for ( let sub of rsub.subs ) {
                last_pass_extract_var_consumers(sub)
            }
        }
    }
}



function push_constant_values(dtable_rule) {
    if ( !(dtable_rule) ) return
    if ( typeof dtable_rule === "string" ) return
    for ( let [rdef,rsub] of Object.entries(dtable_rule) ) {
        if ( typeof rsub === "object" && rsub.subs ) {
            if ( is_constant_yielding_form(rdef) ) {
                if ( (rsub.var_evals !== undefined) && ( Object.keys(rsub.var_evals).length ) ) {
                    for ( let subm of rsub.subs ) {
                        for ( let [sky, sub] of Object.entries(subm) ) {
                            if ( sub.var_consume ) {
                                for ( let vky in sub.var_consume ) {
                                    let cval = rsub.var_evals[vky]
                                    if ( cval !== undefined ) {
                                        sub.var_consume[vky].input = cval
                                        let evaled_goal_marker = ""
                                        if ( is_subst_var_consumer(sky) ) {
                                            evaled_goal_marker = subst_all(sky,`\${${vky}}`,cval.value)
                                        } else if ( is_match_var_consumer(sky) &&  (sub.var_consume[vky].type === 'path-select' ) ) {
                                            let match_val = popafter(sky,'=')
                                            if ( match_val === cval.value.value ) {
                                                sub.live_path = true
                                                let operative = sub.var_consume[vky].goal_op
                                                evaled_goal_marker = `${operative} \${p_list} # ${match_val}`
                                            } else {
                                                sub.live_path = false
                                            }
                                        } else if ( is_type_check(sky) &&  (sub.var_consume[vky].type === 'file-type' )) {
                                            let ftype = sub.var_consume[vky].check
                                            // popout(popafter(sky,'('),':')
                                            // ftype = '.conf'
                                            evaled_goal_marker = `${sub.var_consume[vky].input}${ftype}`
                                            //
                                        }
                                        sub.real_goal = evaled_goal_marker
//console.log(sky, "GOAL MARKER",evaled_goal_marker)

                                        if ( sub.var_evals === undefined ) sub.var_evals = {}

                                        sub.var_evals[vky] = { "type" : "param", "value" : cval }
                                    }
                                }
                            }    
                        }
                    }

                    if ( Array.isArray(rsub.subs) ) {           // FILTER : only live paths
                        rsub.subs = rsub.subs.filter ( subpair => {

                            let kys = Object.keys(subpair)[0]
                            let sub = subpair[kys]

                            if ( sub.live_path !== undefined ) {
                                return sub.live_path
                            }
                            return true
                        })
                        //rsub.subs.forEach( ss => { console.dir(ss,{depth : null})})
                    }


                    for ( let sub of rsub.subs ) {
                        push_constant_values(sub)
                    }
                }
            }
        }
    }
}




function r_hunt_match_termini(terminal_list,marker,deeper_rules) {
    //
    for ( let rules of deeper_rules ) {
        for ( let [rk,robj] of Object.entries(rules) ) {
            if ( robj.subs === 'terminus' ) {
                if ( rk.indexOf(marker) === 0 ) {
                    terminal_list.push(rules)
                }
            } else if ( robj.subs ) {
                r_hunt_match_termini(terminal_list,marker,robj.subs)
            }
        }
    }
    //
}


function hunt_match_termini(terminal_list,marker,rules_of_depth,rdef) {
    //
    for ( let rb of rules_of_depth ) {
        let rules = Object.keys(rb.rule)
        for ( let rk of rules ) {
            if ( rk != rdef ) {
                let robj = rb.rule[rk]
                if ( robj.subs === 'terminus' ) {
                    if ( rk.indexOf(marker) === 0 ) {
                        terminal_list.push(robj)
                    }
                } else if ( robj.subs ) {
                    r_hunt_match_termini(terminal_list,marker,robj.subs)
                }
            }
        }
    }
    //
}


function extract_rule_var_value(subst_var,parent_key,parent_obj,rkey,rule,v_info) {
    //
    if ( parent_obj.var_consume || parent_obj.var_producer ) {
        if ( parent_obj.var_consume ) {
            for ( let [vc,vobj] of Object.entries(parent_obj.var_consume) ) {
                if ( vobj.type === 'def-table' ) {
                    let var_val = vc
                    let sub = false
                    let new_subs = []
                    while ( sub = rule.subs.shift() ) {
                        let [sky,sobj] = pair_parts(sub)
                        let new_key = subst_all(sky,`\${${subst_var}}`,var_val)
            //console.log("new_key",`\${subst_var}`,new_key)
                        let new_sub = {}
                        new_sub[new_key] = sobj
                        sobj.real_goal = new_key
                        new_subs.push(new_sub)
                    }
                    rule.subs = new_subs            
                }
            }
        }
    } else {  // maybe the parent key has a value for the variable...
        /*
        console.log("parent_obj > extract_rule_var_value", parent_obj)
        console.log("1.extract_rule_var_value",rule)
        console.log("2.extract_rule_var_value: rkey",rkey)
        console.log("3.extract_rule_var_value",parent_key)
        console.log(" ---- ---- ",subst_var)
        */
        let var_val = popout_parameters(parent_key)
        let sub = false
        let new_subs = []
        while ( sub = rule.subs.shift() ) {
            let [sky,sobj] = pair_parts(sub)
            let new_key = subst_all(sky,`\${${subst_var}}`,var_val)
//console.log("new_key",`\${subst_var}`,new_key)
            let new_sub = {}
            new_sub[new_key] = sobj
            sobj.real_goal = new_key
            new_subs.push(new_sub)
        }
        rule.subs = new_subs
        //console.log(rule)
    }
}



// sect.depth_table 
function bind_unbounded_rules(dtable_rule,rules_of_depth ) {
    if ( !(dtable_rule) ) return
    if ( typeof dtable_rule === "string" ) return
    for ( let [rdef,rsub] of Object.entries(dtable_rule) ) {
        if ( typeof rsub === "object" && rsub.subs ) {
            if ( is_unbounded_rule(rdef) ) {
                let terminal_list = []
                let marker = rdef.substring(1)
                marker = popout(marker,'(')
                hunt_match_termini(terminal_list,marker,rules_of_depth,rdef)
                if ( terminal_list.length ) {
                    for ( let terminal of terminal_list ) {
                        let cpy_dtable_rule = clonify(dtable_rule)
                        //terminal.subs = [cpy_dtable_rule]
                        let rkey = Object.keys(cpy_dtable_rule)[0]
                        let rule = cpy_dtable_rule[rkey]
                        for ( let [kt,tobj] of Object.entries(terminal) ) {
                            if ( rule.var_producer ) {
                                let subst_var = rule.var_producer
                                if ( typeof subst_var === 'string' ) {
                                    extract_rule_var_value(subst_var,kt,tobj,rkey,rule)
                                } else {
                                    for ( let [svr,v_info] in Object.entries(subst_var) ) {
                                        extract_rule_var_value(svr,kt,tobj,rkey,rule,v_info)
                                    }
                                }
                            }
                            tobj.subs = rule.subs
                        }
                        push_constant_values(terminal)
                    }
                }
            }
        }
    }
}




function collect_optional_parameter_rules(dtable_rule,opt_rules,rule_heads) {
    if ( !(dtable_rule) ) return
    if ( typeof dtable_rule === "string" ) return
    for ( let [rdef,rsub] of Object.entries(dtable_rule) ) {
        if ( typeof rsub === "object" && rsub.subs ) {
            if ( has_optional_parameter_structure(rdef) ) {
                let deoptionalized = form_without_options(rdef)
                opt_rules[deoptionalized] = rdef
            }
            rule_heads[rdef] = rsub
        }
    }
}



function pre_process_rules(rules,optional_parameter_rules,rule_heads,defs_obj) {
    let rule_base = {}
    //
    for ( let [rb_name,rbase] of Object.entries(rules) ) {
        rule_base[rb_name] = local_text_substitutions_and_var_table(rbase)
    }
    //
    for ( let [ky,sect] of Object.entries(rule_base) ) {

        let src_txt = sect.converted                // text representation of the rule definitions
        let rules_of_depth = get_rules_of_depths(src_txt,1)
        sect.depth_table = rules_of_depth
        //
        let n = sect.depth_table.length
        for ( let i = 0; i < n; i++ ) {
            let rtxt = sect.depth_table[i]
            sect.depth_table[i] = {
                "var_stack" : {},
                "rule" : r_rule_tree_type_1(rtxt,1)
            }
            //
            let dtable_rule = sect.depth_table[i].rule
            map_rules_def_to_structure(dtable_rule)
            //
            last_pass_extract_var_consumers(dtable_rule)
            push_constant_values(dtable_rule)
            //
            if ( optional_parameter_rules ) {
                collect_optional_parameter_rules(dtable_rule,optional_parameter_rules,rule_heads)
            }
        }

        for ( let i = 0; i < n; i++ ) {
            let dtable_rule = sect.depth_table[i].rule
            bind_unbounded_rules(dtable_rule,rules_of_depth)
        }
    }
    //
    return rule_base
}







function process_rules(rules) {
    //
    //
    let all_stacks = {}
    let rule_base = {}
    let optional_parameter_rules = {}
    rule_base.running = local_text_substitutions_and_var_table(rules.running)
    //
    //
    for ( let [ky,sect] of Object.entries(rule_base) ) {
        let src_txt = sect.converted                // text representation of the rule definitions
        let rules_of_depth = get_rules_of_depths(src_txt,1)
        sect.depth_table = rules_of_depth
        //
        let n = sect.depth_table.length
        for ( let i = 0; i < n; i++ ) {
            let rtxt = sect.depth_table[i]
            sect.depth_table[i] = r_rule_tree_type_1(rtxt,1)
        }

        let gmap = {}
        sect.goal_map = gmap
        for ( let entry of sect.depth_table ) {
            //
            let ky = Object.keys(entry)[0]
            let popky = popout(ky,EOF_KEY)
            popky = remove_spaces(popky)
            if ( popky.indexOf('),') > 0 ) {
                popky = toplevel_split(popky,',')
            } else popky = [popky]
            //
            //
            let subgoal_txt = entry[ky]

            for ( let gky of popky ) {
                //
                let after_piece = popafter(ky,EOF_KEY)
                after_piece = after_piece.trim()
                //
                let stack = {}          // var to stack index
                let binder = {}
                let subgoals = ""
                //
                all_stacks[gky] = stack
                if ( is_binder(after_piece) || is_super_binder(after_piece)  ) {
                    let [binder_update,rest_line] = bind_goal_param(binder,after_piece,gky)
                    if ( binder_update ) binder = binder_update
                    if ( rest_line ) after_piece = rest_line
                    else after_piece = ""
                    //
                    custom_stack_push(stack,binder)
                }

                after_piece = remove_spaces(after_piece)
                
                if ( (after_piece.length > 0)  && (subgoal_txt === 'one-line') ){
                    if ( after_piece.indexOf(',') > 0 ) {
                        subgoals = toplevel_split(after_piece,',')
                    } else {
                        subgoals = [after_piece]
                    }
                }

                if ( typeof subgoals === 'string' ) {
                    if ( Array.isArray(subgoal_txt) ) {
                        subgoals = subgoal_list_to_map(subgoal_txt,binder,stack,all_stacks)
                    } else {
                        subgoals = subgoal_txt
                    }
                }

                //
                if ( has_optional_parameter_structure(gky) ) {
                    optional_parameter_rules[gky] = {
                        binder,
                        subgoals
                    }
                    let deoptionalized = form_without_options(gky)
                    gmap[deoptionalized] = {
                        binder,
                        subgoals
                    }
                } else {
                    gmap[gky] = {
                        binder,
                        subgoals
                    }    
                }

            }
        }

    }

    return [rule_base,optional_parameter_rules]
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
    let rules = {}

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
            maybe_def = (maybe_def === 'rul') ? lparts[1].substring(0,lparts[1].indexOf('=')).trim() : maybe_def

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
            } else if (maybe_def == 'rules' ) {
                let type = ""
                if ( has_symbol(lparts[1],'(') ) {
                    type = get_type_specifier(lparts[1])
                    lparts[1] = lparts[1].replace(type,'')
                }
                if ( has_symbol(lparts[1],'=') ) {
                    key = get_end_var_name(lparts[1])
                }
                if ( maybe_def == 'rules' ) rules[key] = rest_p.trim()
            } 
        } else {        // something else ... not being classified (special app?)
            preamble = p
        }
    }

   
    return { preamble, defs, acts, goals, rules }
}




//--  associate_final_state_goal_with_machines
// attach the goals for a host onto the host object to access it from there.
// after this, the goal map will not be required except as a shortcut to attach rules and build petri type graphs or retes
//
function associate_final_state_goal_with_machines(goal_set_ky,running,graph) {
    //
    for ( let [ky,g] of Object.entries(running) ) {
        let machine = graph[ky]
        if ( machine ) {
            if ( graph[ky].final_state === undefined ) {
                graph[ky].final_state = {}
            }
            graph[ky].final_state[goal_set_ky] = g
        }
    }
    //
}




function form_with_options(rhead) {
    let goal_name = popout(rhead,'(')
    let pars = popafter(rhead,'(')
    pars = pars.substring(0,pars.lastIndexOf(')'))
    pars = toplevel_split(pars,',')
    let first_par = pars.shift()
    if ( pars.length ) {
        pars = pars.map(par => '@')
        pars = pars.join(',')
        return `${goal_name}(${first_par},${pars})`    
    } else {
        return`${goal_name}(${first_par})`
    }
}



function count_entries(plist) {
    let n = plist.length
    if ( n === 0 ) return 0
    if ( (n === 1) && (plist[0] == ')') ) return 0
    //
    let p_count = 0
    for ( let i = 0; i < n; i++ ) {
        let c = plist[i]
        if ( c === ',' ) p_count++
    }
    return p_count+1
}


//--  associate_rules_with_state_goal
// As part of builing the causality network, setup the tree of goals needed to get a particular app 
// running on a particular machines
function associate_rules_with_state_goal(goals,rules,rules_optional) {
    //
    for ( let [host_nick_name,g] of Object.entries(goals) ) {
        console.log("-----",host_nick_name)
        g.subgoals = {}         // add subgoals to the host's list of goals
        for ( let gf of g.goal_facts ) {
            //
            let rnet = rules[gf]
            //
            if ( rnet ) {
                g.subgoals[gf] = rnet
            } else {
                let opt_key = rules_optional[gf]
                if ( !opt_key ) {
                    opt_key = form_with_options(gf)
                }
                //
                rnet = rules[opt_key]
                //
                if ( rnet ) {
                    g.subgoals[gf] = rnet
                } else {
                    g.subgoals[gf] = "TBD"   // only building a subgoal tree for entries that have rules that allow a tree to be made.
                }
            }
        }
    }
    //
}








function abstract_subkey(sub_ky) {
    let ky = popout(sub_ky,'(')
    let params = popafter(sub_ky,'(')
    params = params.substring(0,params.lastIndexOf(')'))
    param = toplevel_split(params)
    ky += '-' + param.length
    return ky
}


function find_support_points(u_rules,goals) {
    if ( goals === undefined )  return
    if ( typeof goals === 'string' ) return
    //
    for ( let g in goals ) {
        let machine_goals = goals[g]
        let expandable = false
        if ( Array.isArray(machine_goals.subgoals) ) {
            // leave the array alone unless it can be subgoaled.
            for ( let sub_ky of machine_goals.subgoals ) {
                let abstracted_sbky = abstract_subkey(sub_ky)
                if ( abstracted_sbky in u_rules ) {
                    expandable = true
                    break
                }
            }
            //
            if ( expandable ) {
                let ky_array = machine_goals.subgoals
                machine_goals.subgoals = {}
                for ( let sub_ky of ky_array ) {
                    let abstracted_sbky = abstract_subkey(sub_ky)
                    if ( abstracted_sbky in u_rules ) {
                        machine_goals.subgoals[sub_ky] = clonify(u_rules[abstracted_sbky])
                    } else {
                        machine_goals.subgoals[sub_ky] = 'TBD'
                    }
                }
            }
        } else {
            if ( typeof machine_goals === "string" ) continue
            for ( let [sub_ky,goal] of Object.entries(machine_goals.subgoals) ) {
                if ( goal === "TBD" ) {
                    if ( sub_ky in u_rules ) {
                        let abstracted_sbky = abstract_subkey(sub_ky)
                        machine_goals.subgoals[sub_ky] = clonify(u_rules[abstracted_sbky])
                    }
                } else {
                    find_support_points(u_rules,goal.subgoals)
                }
            }
        }
    }
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
                let sub_name = popout(line,EOF_KEY)
                let rest = popafter(line,EOF_KEY).trim()
                let typer = rest.substring(0,2)
                let ltype = 'sect'
                switch ( typer[0] ) {
                    case '@' : { ltype = 'placer'; break; }
                    case '|' : { 
                        ltype = 'param'; 
                        switch ( typer[1] ) {
                            case EOF_KEY : { ltype = 'sender'; break; }
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

            line = line.substring(depth+2).trim()  // should be a EOF_KEY after --
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
    } else if ( exec_line[0] === EOF_KEY ) {  // sender
        //
        exec_line = exec_line.substring(1).trim()
        let expath = exec_line.split('->')
        expath = trimmer(expath)
        //
        exln_descr.goal = 'sender'        // also a match type
        exln_descr.path = expath        // should translate keywords, etc.
        //
        if ( expath[1][0] === EOF_KEY ) {
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
    let src_parts = src_str.split(EOF_KEY)
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




function r_initial_state_all_goals(goal) {
    if ( goal ) {
        goal.all_ready = false
    } else return 
    //
    let subg = goal.subgoals
    if ( Array.isArray(subg) ) {
        let gs_map = {}
        for ( let sg of subg ) {
            gs_map[sg] = { "all_ready" : false }
        }
        goal.subgoals = gs_map
    } else if ( subg ) {
        for ( let [ky,sgoal] of Object.entries(subg) ) {
            if ( sgoal === "TBD" ) {
                subg[ky] = { "all_ready" : false }
            } else {
                sgoal.all_ready = false
                r_initial_state_all_goals(sgoal)    
            }
        }
    }
    //
}


function initial_state_all_goals(goals_obj)  {
    for ( let [ky,all_node_goal] of Object.entries(goals_obj) ) {
        for ( let [sky,sgoal] of Object.entries(all_node_goal) ) {
            r_initial_state_all_goals(sgoal)
        }
    }
}




// ---- value propagation.
//
//

function all_vars_from_host(sky) {
    let top_vars = preamble_obj.scope
    let directories = defs_obj.path_abbreviations

    let host = defs_obj.host.by_key.abbr[sky]
    let master_host = defs_obj.host.master
    let ssh = defs_obj.ssh[host.addr]

    let valid_url = (host.host[0] !== '@') ?  true : false
    //

    return {
        top_vars,
        host,
        master_host,
        ssh,
        directories,
        valid_url
    }
        
}


function value_transform(sky,map_values) {
    //
    let var_starter = sky.indexOf('$')
    while ( var_starter >= 0 ) {
        let c = sky[var_starter+1]
        if ( (c === '[') || (c === '{') ) {
            switch ( c ) {
                case '[' : {
                    //
                    let src = sky.substring(var_starter)
                    let $var = next_var_form(src)
                    let vky = $var.substring(1)
                    //
                    if ( vky in map_values.directories.local ) {
                        let value = map_values.directories.local[vky]
                        sky = subst_all(sky,$var,value)
                    } else if ( vky in map_values.directories.remotes ) {
                        let value = map_values.directories.remotes[vky]
                        sky = subst_all(sky,$var,value)
                    }
                    break;
                }
                case '{' : {
                    let src = sky.substring(var_starter)
                    let $var = next_var_form(src)
                    let vky = $var.substring(2)
                    vky = vky.substring(0,vky.lastIndexOf('}'))
                    //
                    if ( vky && (vky.indexOf('.') > 0) ) {
                        let opath = vky.split('.')
                        opath = trimmer(opath)
                        let value = map_values
                        while ( opath.length ) {
                            value = value[opath.pop()]
                        }
                        if ( value[0] === '@' ) value = "default"  // @ tells us not to evaluate
                        sky = subst_all(sky,$var,value)
                    } else {
                        if ( vky in map_values.top_vars ) {
                            // vky
                            let value = map_values.top_vars[vky]
                            sky = subst_all(sky,$var,value)
                        } else {
                            /*
console.log(sky,  `@binder=${vky}` )
console.dir(binders,{ depth: null })
                            let value = `@binder=${vky}`
                            if ( binders.params ) {
                                let v = binders.params[vky]
                                if ( v !== undefined ) {
                                    value = v
                                }
                            }
                            sky = subst_all(sky,$var,value)
                            */
                        }
                    }
                    //
                    break;
                }
            }
        }
        var_starter = sky.indexOf('$')
    }
    return sky
}



function handle_terminal(sky,parent_ky,goal,map_values,depth) {

}


// push_constant_values 1760

function subst_global_values(sky,map_values,goal) {
    //subst_all(sky,`\${${vky}}`,cval.value)
    //
    let vars_in_sky = all_var_forms(sky)
    for ( let vr in vars_in_sky ) {

        if ( vr.indexOf('.') > 0 ) {
            vr = popout_var_of_var_form(vr)
            let vpath = vr.split('.')
            let val = get_dot_val(vpath,map_values)
            if ( (typeof val === 'string') && (val.length > 0) ) {
                sky = subst_all(sky,`\${${vr}}`,val)
                if ( goal.var_producer ) {
                    for ( let [pvr,prod] of Object.entries(goal.var_producer) ) {
                        let n = prod.selections.length
                        for ( let i = 0; i < n; i++ ) {
                            let txt = prod.selections[i]
                            prod.selections[i] = subst_all(txt,`\${${vr}}`,val)
                        }
                    }
                }
            }
        } else if ( vr.indexOf('$[') === 0 ) {   // handle directory
            vr = vr.substring(1)
            let dirs_vars = map_values.directories
            let val = false
            if ( vr in dirs_vars.local ) {
                val = dirs_vars.local[vr]
            } else if ( vr in dirs_vars.remotes ) {
                val = dirs_vars.remotes[vr]
            }
            if ( (typeof val === 'string') && (val.length > 0) ) {
                sky = subst_all(sky,`\$${vr}`,val)
            }
        } else if ( is_subst_var_consumer(vr) ) {
            if ( goal && goal.var_consume ) {
                let vr_plain = popout_var_of_var_form(vr)
                let vcnsmr = goal.var_consume[vr_plain]
                let val = ""
                if ( vcnsmr ) {
                    val = (typeof vcnsmr.input === 'string') ? vcnsmr.input : vcnsmr.input.value
                    if ( (typeof val === 'string') && (val.length > 0) ) {
                        sky = subst_all(sky,`${vr}`,val)
                    }
                }
            }
        }
    }



    return sky
}






function parse_expr_call(expr) {
    if ( typeof expr !== 'string' ) return expr
    if ( expr.indexOf('(') < 0 ) return expr
    let caller = popout(expr,'(')
    let params = popout_parameters(expr)
    let call_tree = {
        "caller" : caller
    }
    if ( params.length ) {
        if ( params.indexOf(',') > 0 ) {
            let pseq = toplevel_split(params,',')
            call_tree.arity = pseq.length
            call_tree.parts = []
            for ( let p of pseq ) {
                let pp = parse_expr_call(p)
                call_tree.parts.push(pp)
            }
        } else {
            call_tree.arity = 1
            call_tree.parts = parse_expr_call(params)
        }
    } else {
        call_tree.arity = 0
    }

    return call_tree
}


function extract_value_map(prod_vars,prod_ast,key_ast) {
    let match_map = prod_vars
    let index = key_ast.arity
    //
    if ( prod_ast.f_type === 'match' ) {
        let extractors = []
        for ( let prt of prod_ast.parts ) {
            if ( prt.parts && Array.isArray(prt.parts) ) {
                if ( prt.parts.length === index) {
                    prt.arity = index
                    extractors.push(prt)
                }
            } else {
                if ( index === 1 ) {
                    prt.arity = 1
                    extractors.push(prt)
                }
            }
        }
        console.log(extractors)
        for ( let extrct of extractors ) {
            if ( extrct.vars ) {
                if ( extrct.default ) {
                    match_map[extrct.vars] = extrct.default
                } else if ( extrct.arity === 1 ) {
                    match_map[extrct.vars] = key_ast.parts
                } else {
                    for ( let i = 0; i < index; i++ ) {
                        let kpart = key_ast.parts[i]
                        let ppart = extrct.parts[i]
                        if ( typeof kpart === typeof ppart ) {
                            if ( typeof kpart === 'string' ) {
                                if ( ppart !== '@' ) {
                                    if ( match_map[ppart] !== undefined ) {
                                        match_map[ppart] = kpart
                                    }
                                }
                            } else if ( typeof kpart === 'object' ) {
                                extract_value_map(prod_vars,ppart,kpart)
                            }
                        }
                    }
                }
            }
        }
    } else if ( prod_ast.f_type === 'call' ) {
        //
        let caller = popout(prod_ast.code,'(')
        if ( caller !== '@' ) {
            if ( match_map[caller] !== undefined ) {
                match_map[caller] = key_ast.caller
            }
        }
        if ( typeof key_ast.parts === 'string' ) {
            let pvar = prod_ast.parts[0]
            match_map[pvar] = key_ast.parts
        }
        
    }

    return match_map
}



function produce_var_while_propogating(var_producer,parent_ky,goal) {
    //
    if ( var_producer ) {
        if ( typeof var_producer === 'string' ) {
            if ( is_punctuated(var_producer) ) {
                let [prod_vars,prod_ast] = parse_var_producer(var_producer)
                let pky_ast = parse_expr_call(parent_ky)
                //
                let match_map = extract_value_map(prod_vars,prod_ast,pky_ast)
                //
                if ( match_map ) {
                    if ( goal.var_evals === undefined ) goal.var_evals = match_map
                    else {
                        for ( let  [pvar,vval] of Object.entries(match_map) ) {
                            goal.var_evals[pvar] = vval
                        }
                        
                    }    
                }
                console.log("---------------------")
                //
            } else {
                //console.log("NOT PUNCTUATED:   ",var_producer)
                //console.log("---------------------")
            }
        } else {   // more to do here

        }

    }
}



function value_type_check(params,var_evals,var_consume) {
    let [ptype,pvar] = params.split(':')
    ptype = ptype.trim()
    pvar = pvar.trim()
    let vinfo = var_consume[pvar]

    if ( vinfo.type ) {
        if ( ptype === vinfo.check ) return true
    }

    //
    return true
}




function value_selection_transform(ky,var_evals,var_consume) {

    if ( is_branch_select(ky) ) {

        let vr = popout(popafter(ky,':'),'=')
        let op = popout(ky,':')
        let match = popafter(ky,'=').trim()



    } else if ( is_type_filter(ky) ) {
        let stem = popout(ky,'(')
        let params = popout_parameters(ky)
        if ( value_type_check(params,var_evals,var_consume) ) {
            ky = stem
        }
    }

    return ky
}



function value_selector_transform(sky,goal,p_goal,var_producer,var_consume) {
    //
    let pars = popout_parameters(sky)
    pars = toplevel_split(pars,',')
    let n = pars.length
    for ( let i = 0; i < n; i++ ) {
        p = pars[i]
        if ( has_selector_structure(p) ) {
            if ( p_goal.var_evals ) {
                let [v_in,v_out] = extract_selection_vars_of_param(p)
                //
                let v_val = p_goal.var_evals[v_in]
                let v_in_info = var_consume[v_in]
                //
                if ( (v_in_info.v_type === "selector") && (v_out === v_in_info.output) ) {
                    if ( goal.var_evals === undefined ) goal.var_evals = {}
                    goal.var_evals[v_out] = {
                        "type" : "path-selector",
                        "value" : v_val
                    }
                }
                //
                pars[i] = v_val
            }
            let new_pars = pars.join(',')    // popout_parameters(sky)
            let stem = popout(sky,"(")
            sky = `${stem}(${new_pars})`
        }
    }
    //
    return sky
}



function branch_select_var(sky,sobj,goal,var_consume) {

    let z_var = var_from_selector(sky)

    if ( goal.var_evals && goal.var_evals[z_var] && var_consume[z_var] ) {
        if ( goal.var_evals[z_var].type === "path-selector" && var_consume[z_var].type == "path-select" ) {
            let check_val = var_consume[z_var].value
            if ( check_val.indexOf(goal.var_evals[z_var].value) === 0 ) return true
            return false
        }
    }

    return true
}


const c_remaining_fields_to_check = [ "var_evals", "var_consume", "var_consume", "p_list" ]

function r_instantiate_remaining_vars_on_fields(obj,map_values,goal) {
    if ( obj && (typeof obj !== 'string') ) {
        if ( Array.isArray(obj) ) {
            let vlist = obj
            let n = vlist.length
            for ( let i = 0; i < n; i++ ) {
                let val = vlist[i]
                if ( val.indexOf('${') === 0 ) {
                    if (  val.indexOf('.') > 0 ) {
                        let i_val = subst_global_values(ky,map_values,goal)
                        vlist[i] = i_val
                    } else {
                        let vmap = map_values.top_vars
                        let vr = popout_var_of_var_form(val)
                        let i_val = vmap[vr]
                        if ( i_val !== undefined ) {
                            vlist[i] = i_val
                        }
                    }
                }
            } 
        } else if ( typeof obj === 'object' ) {

            for ( let ky in obj ) {
                if ( ky.indexOf('${') === 0 ) {
                    let val = subst_global_values(ky,map_values,goal)
                    obj[val] = obj[ky]
                    delete obj[ky]
                }
            }
            for ( let ky in obj ) {
                let fval = obj[ky]
                if ( (typeof fval === 'string') && (fval.indexOf('${') >= 0) ) {
                    let val = subst_global_values(fval,map_values,goal)
                    obj[ky] = val
                } else if ( typeof fval === 'object' ) {
                    r_instantiate_remaining_vars_on_fields(fval,map_values,goal)
                }
            }
        }
    }

}


function instantiate_remaining_vars_on_fields(goal,map_values) {
    //
    for ( let comp of c_remaining_fields_to_check ) {
        let obj = goal[comp]
        r_instantiate_remaining_vars_on_fields(obj,map_values,goal)
    }
    //
}


// ----------------------------

function r_value_propogation_all_goals(sky,parent_ky,goal,map_values,depth) {
    //
    if ( goal ) {
        //
        instantiate_remaining_vars_on_fields(goal,map_values)
        //
        let subgs = goal.subgoals
        if ( subgs ) {
            console.log("r_value_propogation_all_goals -- has subgoals" ,Object.keys(subgs))
        } else {
            
            produce_var_while_propogating(goal.var_producer,parent_ky,goal)

            if ( goal.subs ) {
                //console.log("r_value_propogation_all_goals -- needs subgoals" ,goal.subs.length)
                if ( Array.isArray(goal.subs) ) {
                    subgs = {}
                    for ( let sub of goal.subs ) {
                        let [sky,sobj] = pair_parts(sub)

                        if ( is_subst_var_consumer(sky) || is_subst_dir_consumer(sky) ) {
                            sky =  subst_global_values(sky,map_values,goal)
                        }

                        if ( is_branch_select(sky) ) {
                            instantiate_remaining_vars_on_fields(sobj,map_values)
                            if ( !(branch_select_var(sky,sobj,goal,sobj.var_consume)) ) continue
                        }

                        if ( has_selector_structure_parameter(sky) ) {
                            sky = value_selector_transform(sky,sobj,goal,sobj.var_producer,sobj.var_consume)
                        }
                        
                        {
                            let transformable = false
                            if ( goal.var_evals && sobj.var_consume ) {
                                transformable = true
                                if ( sobj.var_evals === undefined ) sobj.var_evals = {}
                                for ( let vrkey in sobj.var_consume ) {
                                    let val = goal.var_evals[vrkey]
                                    if ( val !== undefined ) {
                                        sobj.var_evals[vrkey] = val
                                    }
                                }
                            }
                            console.log("CHECK TRANSFORM -- ky,sobj----",parent_ky,sky,transformable)
                            sky = transformable ? value_selection_transform(sky,sobj.var_evals,sobj.var_consume) : sky
                        }

                        let sky_base = sky
                        let i = 1
                        while ( subgs[sky_base] !== undefined ) {
                            sky_base = `${sky}_${i}`
                            i++
                        }
                        subgs[sky_base] = sobj
                    }
                    goal.subgoals = subgs
                    delete goal.subs
                } else {
                    handle_terminal(sky,parent_ky,goal,map_values,depth)
                }
            } else {
console.log("NO SUBS: ",sky,parent_ky,goal)
            }
        }
        // there are subgoals... fix them up... 
        if ( subgs ) {
            for ( let [ky,sgoal] of Object.entries(subgs) ) {

                let vky = ky
    //console.log("ky,sgoal----",vky)
    console.log("<<-------------ky,sgoal-------------",parent_ky,ky)
    //
                sgoal.real_goal = vky
                r_value_propogation_all_goals(`${sky}.${ky}`,ky,sgoal,map_values,(depth + 1))
            }
        }
    }
    //
}


// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----


function value_propogation_all_goals(goals_obj) {
    for ( let [ky,all_node_goal] of Object.entries(goals_obj) ) {   // such as =running from the section def
        goals_obj[ky] = clonify(all_node_goal)                      // had to make a copy (can be repeated by host(=node))
        all_node_goal = goals_obj[ky]
        for ( let [host_name_abbr,host_node] of Object.entries(all_node_goal) ) {   // these are the nodes
            let map_values = all_vars_from_host(host_name_abbr)
            let hky = host_name_abbr
            r_value_propogation_all_goals(hky,hky,host_node,map_values,1)
        }
    }
}


// ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----



function r_garner_requirements(gky_list,goal,fresh_goal_list) {
    if ( !goal ) return 
    //
    if ( goal.all_ready === false || goal.all_ready === undefined ) {
        if ( goal.all_ready === undefined ) goal.all_ready = false
        //
        let subg = goal.subgoals
        if ( subg ) {
            for ( let [ky,sgoal] of Object.entries(subg) ) {
                if ( sgoal.all_ready === false || sgoal.all_ready === undefined ) {
                    if ( goal.all_ready === undefined ) goal.all_ready = false
                    //
                    if ( typeof sgoal.real_goal  === 'string' ) {
                        ky = sgoal.real_goal
                    }    
                    if ( !(sgoal.subgoals) ) {
                        let gpath_info = {}
                        gpath_info[ky] = [...gky_list,ky]
                        fresh_goal_list.push( gpath_info )
                    } else {
                        r_garner_requirements([...gky_list,ky],sgoal,fresh_goal_list)
                    }
                }
            }
        } else {
            fresh_goal_list.push(goal)
        }
    }
    //
}


function garner_requirements(goals_obj) {
    let fresh_goal_list = []
    for ( let [ky,all_node_goal] of Object.entries(goals_obj) ) {  // all the different kinds of goals
        for ( let [sky,sgoal] of Object.entries(all_node_goal) ) {
            if ( !(sgoal.subgoals) ) {
                let gpath_info = {}
                if ( typeof sgoal.real_goal === 'string' ) {
                    sky = sgoal.real_goal
                }
                gpath_info[sky] = [ky,sky]
                fresh_goal_list.push( gpath_info )
            } else {
                if ( typeof sgoal.real_goal  === 'string' ) {
                    sky = sgoal.real_goal
                }
                r_garner_requirements([ky,sky],sgoal,fresh_goal_list)
            }
        }                
    }
    return fresh_goal_list
}



// ---------- MAIN  ----------  ----------  ----------  ----------  ----------  ---------- 


const g_out_dir_prefix = './scripts'
let all_machines_script = './all-machines.conf'


//  MAIN PROGRAM STARTS HERE
async function main_prog() {

    //
    // LOAD ANY DESCRIPIONS AND CONFIGS
    //
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
    
    // LOAD ANY DESCRIPIONS AND CONFIGS
    //
    confstr = eliminate_line_start_comments(confstr,'--')           // comments on the whole line (gone)
    confstr = eliminate_empty_lines(confstr)                        // empty line
    confstr = eliminate_line_end_comments(confstr,'\\s+--')         // comments written after actionable lines ( tail line gone)
    //
    let top_level = top_level_sections(confstr)                     // pull out data structure refering to text of separate sections

    ////    process_preamble -- the preamble has variable definitions, graph definitions and current state files
    preamble_obj = process_preamble(top_level.preamble)
    ////    process_defs -- defines the list of hosts, definitions for directories, perhaps more
    defs_obj = process_defs(top_level.defs)
    ////    process_goals -- for each host, declares a list of desireable states (goals) to which rules can be attached
    goals_obj = process_goals(top_level.goals)
    //
    //  subst_defs_in_scope_vars -- before further processing, put values into as many variables as possible 
    subst_defs_in_scope_vars(preamble_obj,defs_obj)

//
await fos.output_string("./auth_graph_preamble.json",JSON.stringify(preamble_obj.graph,null,2))

    // For each goal class, attach the host goal structure to the access graph
    //
    for ( let [goal_set_ky,host_map] of Object.entries(goals_obj) ) {
        associate_final_state_goal_with_machines(goal_set_ky,host_map,preamble_obj.graph.g)
    }

    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----

    //
    //  (PRE) PROCESS RULES ---- all rule definitions turned into data structure with variables evaluated as much as possible
    let rules_with_options = {}
    let rule_heads = {}
    //
    let rule_base = pre_process_rules(top_level.rules,rules_with_options,rule_heads,defs_obj)
   
    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----


    // associate_rules_with_state_goal
    //      attach rule structures to goal states belonging to hosts. Make copies of rules for each host (for using different var values)
    //
    console.log("--------------------------------->associate_rules_with_state_goal")
    for ( let [ky,host_map] of Object.entries(goals_obj) ) {
        associate_rules_with_state_goal(host_map,rule_heads,rules_with_options)
    }


    //// IF NO CURRENT STATE

    // initial_state_all_goals  -- walk the gloal/rule tree indicating that nothing has been done (initial state)
    initial_state_all_goals(goals_obj)


    // value_propogation_all_goals -- puch values from the host down through the rules and prune unused paths

    console.log("--------------------------------->value_propogation_all_goals")
    value_propogation_all_goals(goals_obj)

    // ELSE --- update any values derived from assessing state passed back by arc travelers

    // END IF

    /// CONTINUE FROM HERE

    //
    await fos.output_string("./r_test_output.json",JSON.stringify(rule_base,null,2))
    await fos.output_string("./g_test_output.json",JSON.stringify(goals_obj,null,2))
    

    // CURRENT SET OF GOALS
    // garner_requirements -- walks the goal tree produce the lowest level goals needed to be completed 
    //

    let present_goals = garner_requirements(goals_obj)   // current list of things to do...

    //
    await fos.output_string("./present_goals.json",JSON.stringify(present_goals,null,2))

    let prioritized_present_goals = present_goals.sort((a,b) => {
        let [a_key,a_path] = pair_parts(a)
        let [b_key,b_path] = pair_parts(b)
        let a_is_pre = a_path.indexOf('pre') >= 0
        let b_is_pre = b_path.indexOf('pre') >= 0
        if ( a_is_pre && b_is_pre ) return(0)
        if ( a_is_pre ) return -1
        if ( b_is_pre ) return 1
        let a_is_post = a_path.indexOf('post') >= 0
        let b_is_post = b_path.indexOf('post') >= 0
        if ( a_is_post && b_is_post ) return(0)
        if ( a_is_post ) return 1
        if ( b_is_post ) return -1
        return 0
    })
    //

    await fos.output_string("./prioritized_present_goals.json",JSON.stringify(prioritized_present_goals,null,2))


    // FINALLY -- launch arc travelers with the commands needed to satisfy the current set of goals


}


main_prog()
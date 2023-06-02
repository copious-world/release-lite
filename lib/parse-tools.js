const {
    popout,
    popafter,
    trimmer
} = require('./utilities')




function parameter_pop(parent_ky) {
    let par_list = parent_ky.substring(parent_ky.indexOf('(') + 1)
    par_list = par_list.substring(0,par_list.lastIndexOf(')'))
    par_list = par_list.trim()
    return par_list
}


function popout_parameters(ffrm) {
    let pars = popout(popafter(ffrm,'('),')')
    return pars
}

function popout_var_of_var_form(vfrm) {
    if ( vfrm[0] === '$' ) vfrm = vfrm.substring(1)
    let vr = popout(popafter(vfrm,'{'),'}').trim()
    return vr
}



function is_binder(code) {
    return ( /^-\>[ABCDEFGHIJKLMNOPQRSTUVWXYZ]+$/.test(code) ) 
}

function is_super_binder(code) {
    if ( (code.indexOf('->') === 0) && ( code.substring(2).trim().length > 0 ) ) return true
    return false
}



function parameter_is_binder(factoid) {
    let chktxt = popout(popafter(factoid,'('),')')
    if ( chktxt.indexOf('->') > 0 ) return true
    return false
}


function pop_selector(str) {
    str = str.trim()
    if ( str[0] == '/' ) {
        str = str.substring(1)
        let parts = str.split('\/?')
        parts = trimmer(parts)
        let sltr = parts[0]
        let rest = parts[1]
        return [sltr,rest]
    }
    return ["",false]
}



// toplevel_split
//
//  requires that the top level parathentical symbols be removed from a string, e.g. "(a,b(c,d),e)" 
//  should be passed as "a,b(c,d),e"

let starters = "([{"
let enders = "}])"

function toplevel_split(str,delim) {
    
    let cdepth = 0
    let splits = []
    let n = str.length
    let cur_split = ""
    for ( let i = 0; i < n; i++ ) {
        let c = str[i]
        if (( c === delim) && (cdepth === 0) ) {
            splits.push(cur_split)
            cur_split = ""
        } else {
            if ( starters.indexOf(c) >= 0 ) {
                cdepth++
            } else if ( enders.indexOf(c) >= 0 ) {
                cdepth--
            }
            cur_split += c
        }
    }
    //
    if ( cur_split.length > 0 ) {
        splits.push(cur_split)
    }
    splits = trimmer(splits)
    //
    return splits
}


function pop_to_unbounded_space(str) {
    // ---- ---- ---- ---- ---- ----
    str = str.trim()
    const delim_s = ' '
    const delim_t = '\t'

    let cdepth = 0
    let splits = []
    let n = str.length
    let cur_split = ""

    for ( let i = 0; i < n; i++ ) {
        let c = str[i]
        if ( (cdepth === 0) && ( c === delim_s || c === delim_t) ) {
            splits.push(cur_split.trim())
            let rest  = str.substring(i+1).trim()
            splits.push(rest)
            break
        } else {
            if ( starters.indexOf(c) >= 0 ) {
                cdepth++
            } else if ( enders.indexOf(c) >= 0 ) {
                cdepth--
            }
            cur_split += c
        }
    }

    if ( splits.length < 2 ) {
        splits.push(cur_split.trim())
        splits.push("")
    }
    //
    return splits
}




function get_type_specifier(str) {
    let type = str.substring(str.indexOf('('),str.indexOf(')')+1)
    return type
}


function form_subst(out_str,var_forms,vf_lookup,access,maybe_addr) {
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


function get_type_marker(table_str,deflt) {
    let table_type = deflt
    if ( table_str[0] === '(' ) {
        table_type = table_str.substring(0,table_str.indexOf(')')+1)
        table_str = table_str.replace(table_type,'').trim()
    }
    return [table_type,table_str]
}




function var_from_selector(key) {
    let a_var = popafter(key,':')
    a_var = popout(a_var,'=')
    return a_var.trim()
}



function extract_selection_vars_of_param(param) {
    let parts = param.split('->')
    parts = trimmer(parts)
    let p1 = parts[0].split('/?')
    p1 = trimmer(p1)
    let var_in = p1[0].substring(1)
    let var_out = parts[1]
    return [var_in,var_out]
}








// parse debug tools
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






// --------

function has_optional_parameter_structure(rhead) {
    return /.*,\s*\*.*/.test(rhead)
}


function is_conditional_value_assignment(str) {
    if ( str.indexOf('=>') === 0 ) return true
    return false
}

function pop_past_value_assigner(str) {
    let front_str = str.substring(0,2)
    str = str.substring(2)
    let rest = ""
    let n = str.length
    for ( let i = 0; i < n; i++ ) {
        let c = str[i]
        if ( c === '=' ) {  // start of the assignment
            front_str += '='
            i++
            while ( i < n && (c == ' ' || c == '\t')  ) { c = str[i]; i++ }
            while ( i < n && (c !== ' ' || c !== '\t')  ) { c = str[i]; front_str += c ; i++ }
            rest = str.substring(i).trim()
            break;
        }
        front_str += c
    }

    return [front_str,rest]
}


function pop_var_producer(code_src) {
    code_src = code_src.trim()
    let [var_producer,restl] = pop_to_unbounded_space(code_src)
    restl = restl.trim()
    //
    if ( is_conditional_value_assignment(restl) ) {
        let [var_p_continue,rest2] = pop_past_value_assigner(restl)
        var_producer += var_p_continue
        restl = rest2
    }
    //
    while ( restl[0] === '|' ) {
        var_producer += '|'
        let [vp2,rest2] = pop_to_unbounded_space(restl.substring(1))
        var_producer += vp2
        if ( is_conditional_value_assignment(rest2) ) {
            let [var_p_continue,rest3] = pop_past_value_assigner(rest2)
            var_producer += var_p_continue
            rest2 = rest3
        }
    
        restl = rest2.trim()
    }

    return [var_producer,restl]
}





function form_without_options(rhead) {
    let goal_name = popout(rhead,'(')
    let pars = popafter(rhead,'(')
    pars = pars.substring(0,pars.lastIndexOf(')'))
    pars = toplevel_split(pars,',')
    pars = pars.filter( el => (el !== '@') )
    pars = pars.join(',')
    return `${goal_name}(${pars})`
}


function has_goal_structure(goal_part) {
    if ( typeof goal_part === 'string' ) {
        if ( /.+\(.*\)/.test(goal_part)  ) {
            return true
        }
    }
    return false
}

function has_list_structure(goal_part) {
    if ( typeof goal_part === 'string' ) {
        if ( /^\[(.+)(,.+)*\]$/.test(goal_part)  ) {
            return true
        }
    }
    return false
}


function has_selector_structure(producer_part) {
    let str = producer_part.trim()
    if ( str[0] === '/' && str.indexOf('\/?') > 0 && str.indexOf('|') > 0 ) {
        return true
    }
    return false
}

function has_selector_structure_parameter(rule_key) {
    let params = popout_parameters(rule_key)
    params = toplevel_split(params,',')
    for ( let p of params ) {
        if ( has_selector_structure(p) ) return true
    }
    return false
}




function is_subst_var_consumer(frm) {
    if ( frm.indexOf('${') >= 0 ) return true
    return false
}


function is_subst_dir_consumer(frm) {
    if ( frm.indexOf('$[') >= 0 ) return true
    return false
}

function is_match_var_consumer(frm) {
    return /^.+\:.+\=/.test(frm)
}


function is_type_check(frm) {
    return /^.+\(\..+\:.+\)/.test(frm)
}



function is_def_table_var(vr) {
    if ( vr.indexOf('.') > 0 ) return true
    return false
}




function is_constant_yielding_form(frm) {
    if ( /^.*\(/.test(frm) ) return true
    return false
}


function is_unbounded_rule(rdef) {
    if ( rdef[0] === '?' ) return true
    return false
}



module.exports = {
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
    
}
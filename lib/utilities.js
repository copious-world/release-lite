
let octet_match = /^\d+\.\d+\.\d+\.\d+.*$/
function is_octet_at_first(str) {
    return ( octet_match.test(str) ) 
}


function is_ipv6_at_first(str) {
    return(true)            // for now just false
}


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
    return (i >= 0)
}


function replace_eol(rest_p,c) {
    while ( rest_p.indexOf('\n') >= 0 ) rest_p = rest_p.replace('\n',c)
    return rest_p
}

function popout(str,stopper) {
    return str.substring(0,str.indexOf(stopper))
}


function strip_front(lines,c) {

    lines = lines.map(ln => {
        if ( ln[0] === c ) return ln.substring(1)
        return ln
    })

    lines = lines.filter(ln => { return ln.length > 0 } )

    return lines
}


let delimit_closers = {
    '[' : ']',
    '{' : '}',
    '(' : ')',
    '|' : '|',
    '^' : '$'
}

function extract_all_keys(str,def_tab,delimit) {
    let keys = []
    //
    let delclose = delimit_closers[delimit]
    if ( delclose === undefined ) return keys
    //
    let next = 0
    while ( next >= 0 ) {
        let i = str.indexOf(delimit,next)
        if ( i >= 0 ) {
            let ky = str.substring(i,str.indexOf(delclose,i)+1)
            let vsubst = def_tab[ky]
            if ( vsubst === undefined ) {
                throw "extract_all_keys: undefined variable replacement in value definition"
            }
            keys.push(ky)
        } else break
        next = i + 1
    }

    return keys
}



function get_end_var_name(def_line) {
    let key_n_name = def_line.split('=')
    key_n_name = trimmer(key_n_name)
    return key_n_name[1]
}


module.exports = {
    strip_front,
    popout,
    replace_eol,
    has_symbol,
    trimmer,
    after_first_line,
    first_line,
    is_ipv6_at_first,
    is_octet_at_first,
    extract_all_keys,
    get_end_var_name
}

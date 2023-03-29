
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


function all_var_forms(str) {
    let n = str.length
    let indexlist = []
    for ( let i = 0; i < (n-1); i++ ) {
        let chck = str[i] + str[i+1]
        if ( (chck === '\$[' ) || (chck === '\${' ) ) {
            indexlist.push(i)
        }
    }
    let forms = {}
    while ( indexlist.length ) {
        let i = indexlist.pop()
        let strt = str.substring(i,i+2)
        let stop = '}'
        if ( strt === '$[') stop = ']'
        let extract = str.substring(i,str.indexOf(stop,i) + 1)
        if ( forms[extract] === undefined ) forms[extract] = []
        forms[extract].push(i)
    }
    //
    return forms
}


function replace_eol(rest_p,c) {
    while ( rest_p.indexOf('\n') >= 0 ) rest_p = rest_p.replace('\n',c)
    return rest_p
}

function popout(str,stopper) {
    return str.substring(0,str.indexOf(stopper))
}


function extract_popout(str,stopper,i) {
    return str.substring(i,str.indexOf(stopper,i))
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


function gulp_section(sect_str,delim_beg,delim_end) {
    if ( sect_str.indexOf(delim_beg) >= 0 ) {
        let i = sect_str.indexOf(delim_beg)
        let section = sect_str.substring(i + delim_beg.length,sect_str.indexOf(delim_end,i) )
        let rest = sect_str.substring(sect_str.indexOf(delim_end,i) + delim_end.length)
        return [section,rest]
    }
    return ""
}


function extract_object_field(sect_str) {
    sect_str = sect_str.trim()
    sect_str = `"${sect_str}`
    sect_str = sect_str.replace(' ','\" ')
//
    let sect = JSON.parse(`{${sect_str}}`)
    for ( let [k,v] of Object.entries(sect) ) {
        return [k,v]
    }
    return [false,false]
}


function subst_all(str,svar,value) {
    while ( str.indexOf(svar) >= 0 ) {
        str = str.replace(svar,value)
    }
    return str
}

function eliminate_line_start_comments(lines_str,cmt_symb) {
    let lines = lines_str.split('\n')
    lines = lines.filter(line => line.substring(0,cmt_symb.length) !== cmt_symb )
    return lines.join('\n')
}

function eliminate_empty_lines(lines_str) {
    let lines = lines_str.split('\n')
    lines = trimmer(lines)
    lines = lines.filter( line => (line.length !== 0) )
    return lines.join('\n')
}

module.exports = {
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
    extract_all_keys,
    get_end_var_name,
    gulp_section,
    extract_object_field,
    subst_all,
    eliminate_line_start_comments,
    eliminate_empty_lines
}


let octet_match = /^\d+\.\d+\.\d+\.\d+.*$/
function is_octet_at_first(str) {
    return ( octet_match.test(str) ) 
}


function is_ipv6_at_first(str) {
    return(true)            // for now just false
}


function iswhite(c) {
    return ( (c == ' ') || (c == '\t') || (c == '\n') )
}


function first_line(str) {
    let eol = str.indexOf('\n')
    if ( eol > 0 ) {
        return str.substring(0,eol)
    } else {
        return str.trim()
    }
}


function after_first_line(str) {
    let eol = str.indexOf('\n')
    if ( eol === -1 ) return ""
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

function popafter(str,starter) {
    return str.substring(str.indexOf(starter) + starter.length)
}


function popout_match(str,rgx) {
    return str.substring(0,str.match(rgx).index)
}

function popout_rest_match(str,rgx) {
    let mtch = str.match(rgx)
    let l = mtch[0].length
    return str.substring(mtch.index+l)
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


function remove_spaces(str) {
    let sfree = ""
    let n = str.length
    for ( let i = 0; i < n; i++ ) {
        let c = str[i]
        if ( c !== ' ' && c !== '\t' ) sfree += c
    }
    return sfree
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



function get_end_var_name(def_line,get_type) {
    let key_n_name = def_line.split('=')
    key_n_name = trimmer(key_n_name)
    if ( get_type ) return key_n_name
    else return key_n_name[1]
}


function gulp_section(sect_str,delim_beg,delim_end) {
    if ( sect_str.indexOf(delim_beg) >= 0 ) {
        let i = sect_str.indexOf(delim_beg)
        let section = sect_str.substring(i + delim_beg.length,sect_str.lastIndexOf(delim_end))
        let rest = sect_str.substring(sect_str.indexOf(delim_end,i) + delim_end.length)
        return [section,rest]
    }
    return ["",""]
}


function extract_object_field(sect_str) {
    sect_str = sect_str.trim()
    sect_str = `"${sect_str}`   // the quotes for JSON are not part of the input
    sect_str = sect_str.replace(':', ' :') // just in case there is no space before the ':'
    sect_str = sect_str.replace(' ','\" ')   // first space after the field Quoates
//
    let sect = JSON.parse(`{${sect_str}}`)   // put the single field into an object
    for ( let [k,v] of Object.entries(sect) ) {   // returns the first field found (expected a string of just one field def)
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


function eliminate_line_end_comments(confstr,regexstr) {

    let regx = new RegExp(regexstr)
    let lines = confstr.split('\n')
    //
    let n = lines.length
    for ( let i = 0; i < n; i++ ) {
        let line = lines[i]
        line = line.split(regx)
        line = line[0]
        lines[i] = line.trim()
    }
    //
    confstr = lines.join('\n')
    return confstr
}



function eliminate_empty_lines(lines_str) {
    let lines = lines_str.split('\n')
    lines = trimmer(lines)
    lines = lines.filter( line => (line.length !== 0) )
    return lines.join('\n')
}




function map_by_key(h,rows) {
    let hmap = {}
    for ( let row of rows ) {    // each row as an object
        let rk = row[h]
        if ( hmap[rk] !== undefined ) {
            if ( Array.isArray(hmap[rk]) ) hmap[rk].push(row)
            else  hmap[rk] = [ hmap[rk], row ]
        } else {
            hmap[rk] = row      // assume distinct on each row.
        }
    } 
    return hmap
}


function create_map_object(header,rows) {
    let by_key = {}
    for ( let h of header ) {
        by_key[h] = map_by_key(h,rows)  // provide different views of same object
    }
    return by_key
}


function table_to_objects(table_str) {

    let rows = []

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
        rows.push(rmap)
    }

    let by_key = create_map_object(header,rows)

    return [rows,by_key,header]
}



function object_list_to_object(def_str) {
    let final_map = {}

    let def_sections = def_str.split('~!')
    def_sections = trimmer(def_sections)

    def_sections.forEach(asection => {

        let line1 = first_line(asection)
        if ( (line1.length === 0) || !is_octet_at_first(line1) || !is_ipv6_at_first(line1)) {
            asection = after_first_line(asection)
            asection = asection.trim()
        }
        //
        let sect_parts = asection.split(':')
        let key = sect_parts.shift().trim()
        sect_parts = sect_parts.join(':').trim()
        //
        final_map[key] = JSON.parse(sect_parts.trim())
    })

    return final_map
}


module.exports = {
    iswhite,
    strip_front,
    remove_spaces,
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
    extract_all_keys,
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
}

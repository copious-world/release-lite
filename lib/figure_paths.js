

const {
    strip_front,
    popout,
    replace_eol,
    has_symbol,
    trimmer,
    after_first_line,
    first_line,
    is_ipv6_at_first,
    is_octet_at_first,
    extract_all_keys
} = require('../lib/utilities')





function path_table(table_str,limit=10) {
    let table_lines = table_str.split('\n')
    table_lines = trimmer(table_lines)
    let ptable = {}
    for ( let tl of table_lines ) {
        if ( tl.length ) {
            tl = tl.split(':')
            tl = trimmer(tl)
            ptable[tl[0]] = tl[1]
        }
    }
    //
    for ( let i = 0; i < limit; i++ ) {
        for ( let [k,v] of Object.entries(ptable) ) {
            if ( v.indexOf('[') >= 0 ) {
                let key_list = extract_all_keys(v,ptable,'[')
                for ( let key of key_list ) {
                    let val = ptable[key]
                    v = v.replace(key,val)
                }
                ptable[k] = v
            }
        }    
    }

    return ptable
}


module.exports.path_table = path_table
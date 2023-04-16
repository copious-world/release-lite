







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


/*
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
*/
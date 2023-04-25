
// ---- ---- ---- ---- ---- ---- ---- ----


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
        top_props.coalesce  = false
    } else  if ( cmd.indexOf('%dir') > 0  ) {
        top_props.goal_type = 'dir'
        top_props.exec = top.ordering.map(ky => top[ky])
        console.dir(top,{ depth: null })
    } else  if ( cmd.indexOf('%sender') > 0  ) {
        top_props.goal_type = 'sender'
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

                if ( line.indexOf(':coalesce') > 0 ) {
                    top_props.coalesce = true
                    line = line.replace(':coalesce','')
                    if ( coalescer.lines === undefined ) coalescer.lines = {}
                    if ( coalescer.lines[top.sect] === undefined ) coalescer.lines[top.sect] = 0
                    coalescer.lines[top.sect]++
                }
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






async function finally_run() {
    //
    for ( let [ky,value] of Object.entries(coalescing.shared_satisfied) ) {
        console.log(ky,value)
        let placer = value.placement
        let path = placer.path.split('>')
    
        console.log(path)
        let start_dir = path[0]
        if ( start_dir === 'here' ) {
            start_dir  = g_out_dir_prefix
        }
        let dest_dir = path[2]
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




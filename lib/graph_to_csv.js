

const {ops_from_goal, setup_ops} = require('./goal_producers')






// GRAPH_FLDS='name,depth,sibs,user,pass,addr,backrefs,upload_scripts,download_scripts,ops,post_ops'

function graph_to_csv(graph,defs_obj,vars,app) {

    let cvsgrph = {}
    for ( let [hname,hinfo] of Object.entries(graph.g) ) {
        //
        let hdef = defs_obj.host.by_key['abbr'].hmap[hname]
        let sshdef = defs_obj.ssh
        //
        let pass = sshdef[hdef.addr].pass
        let user = sshdef[hdef.addr].user

        // 
        if ( app === undefined ) {
            cvsgrph[hname] = {
                "name" : hname,
                "depth" : hinfo.depth,
                "sibs" : hinfo.sibs.join(' '),
                "user" : user,
                "pass" : pass,
                "addr" : hinfo.addr,
                "backrefs" : hinfo.backrefs.join(' '),
                "upload_scripts" : hinfo.upload_scripts,
                "download_scripts" : hinfo.download_scripts,
                "ops" : hinfo.ops,
                "post_ops" : hinfo.post_ops
            }    
        } else if ( app === 'arc-traveler-setup' ) {
            cvsgrph[hname] = {
                "name" : hname,
                "depth" : hinfo.depth,
                "sibs" : hinfo.sibs.join(' '),
                "user" : user,
                "pass" : pass,
                "addr" : hinfo.addr,
                "backrefs" : hinfo.backrefs.join(' '),
                "ops" : hinfo.ops
            }    
        }
    }


    let out_lines = []
    const keys = 'name,depth,sibs,user,pass,addr,backrefs,upload_scripts,download_scripts,ops,post_ops'
    //
    const opaque_flds = 'pass,upload_scripts,download_scripts,ops,post_ops'
    opaque_flds = opaque_flds.split(',')
    //
    let ky_list = keys.split(',')
    for ( let host_def of Object.values(cvsgrph) ) {
        //
        let row = []
        for ( let ky of ky_list ) {
            let str = host_def[ky]
            if ( str ) {
                if ( opaque_flds.indexOf(str) >= 0 ) {
                    str = Buffer.from(str).toString('base64')
                }
                //
                row.push(str)    
            }
        }
        //
        let rowstr = row.join(',')
        out_lines.push(rowstr)
        //
    }

    out_lines = out_lines.join('\n')
    //
    return out_lines
}



// host_from_goal_path(goal_path)
//

function host_from_goal_path(goal_path) {
    return goal_path[1]        //         goal_path[0] -> goal name space   rest -> subgoals
}



// upload_scripts,download_scripts,ops,post_ops
function current_goals_to_script_components(prioritized_goals,graph,defs_obj,vars) {
    //
    for ( let [goal,goal_path] of Object.entries(prioritized_goals) ) {
        //
        let host = host_from_goal_path(goal_path)
        let hinfo = graph.g[host]
        //
        let [upload_scripts,download_scripts,ops,post_ops] = ops_from_goal(goal,hinfo,defs_obj,vars)
        //
        hinfo.upload_scripts = upload_scripts
        hinfo.download_scripts = download_scripts
        hinfo.ops = ops
        hinfo.post_ops = post_ops
        //
    }
    //
}


// upload_scripts,download_scripts,ops,post_ops
function setup_goals_to_script_components(prioritized_goals,graph,defs_obj,vars) {
    //
    for ( let [goal,goal_path] of Object.entries(prioritized_goals) ) { // the goal is the key mapped to the path array
        //  
        let host = host_from_goal_path(goal_path)
        let hinfo = graph.g[host]
        //
        let ops = setup_ops(goal,hinfo,defs_obj,vars)
        hinfo.ops = ops
    }
    //
}




function prepare_graph_for_arc_taveler(prioritized_goals,graph,defs_obj,preamble_obj) {
    //
    current_goals_to_script_components(prioritized_goals,graph,defs_obj,preamble_obj)
    //
    return graph_to_csv(graph,defs_obj,preamble_obj) 
    //
}



function prepare_graph_for_arc_taveler_setup(prioritized_goals,graph,defs_obj,preamble_obj) {
    //
    setup_goals_to_script_components(prioritized_goals,graph,defs_obj,preamble_obj)
    //
    return graph_to_csv(graph,defs_obj,preamble_obj,'arc-traveler-setup') 
    //
}


//

modules.exports.prepare_graph_for_arc_taveler = prepare_graph_for_arc_taveler
modules.exports.prepare_graph_for_arc_taveler_setup = prepare_graph_for_arc_taveler_setup
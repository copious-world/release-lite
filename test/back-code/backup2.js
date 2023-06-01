
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
console.dir(defs_obj,{ depth: null })


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


/*
// ----
(async () => {

//console.dir(goals_obj.running,{ depth: null })

    // ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ---- ----
    // console.log("--------------actionable_tree--------------------")
    //
    // await output_actionable_tree(actionable_tree)
    //
    // console.dir(actionable_tree,{ depth: null })
    // console.dir(defs_obj,{ depth: null })
    //
    console.log("----------------------------------")
    //await traverse_graph(preamble_obj.graph)
    console.log("----------------------------------")
    //
    // await finally_run()  // generate the final run script and submit it to our version of expect...
    //
})()

*/


// mkdir -p foo/bar/zoo/andsoforth








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
        tmpl_str = form_subst(tmpl_str,var_forms,vf_lookup,access,maybe_addr)
    }
    return tmpl_str
}








// ---- traverse_graph 
//

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
        //console.log("deleting",nname,nky)
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
        //console.log("GRAPH")
        //console.dir(base_graph,{ "depth" : null })
    }
    //
    console.dir(graph,{ "depth" : null })
    //
}







/*
            if ( dsubkey.indexOf('${') > 0 ) {   // consumer on the line.. line of subs
                let dvr = dsubkey.substring(dsubkey.indexOf('${')+2)
                dvr = dvr.substring(0,dvr.indexOf('}'))
                if ( dvr ) {
                    if ( dsubinfo.var_consume === undefined ) dsubinfo.var_consume = {}
                    dsubinfo.var_consume[dvr] = {
                        "type"  : "value",
                        "value" : further.var_consume[dvr]
                    }
                }
            }
*/




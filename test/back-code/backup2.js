
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
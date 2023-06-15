
function print_and_run_lines {

    local SAVEIFS=$IFS   # Save current IFS (Internal Field Separator)
    IFS='\n'      # Change IFS to newline char
    local OPS=$1
    local OPS=($OPS) # split the `names` string into an array by the same name
    IFS=$SAVEIFS   # Restore original IFS

    for c in "${OPS[@]}"; do
        c=${c//[$'\t\r\n']}
        if [ ! -z "$c" ]; then
            echo "command is: $c"
            echo $(${c})
        fi
    done
}


function name_field {
    local fld=$1
    local line=$2
    echo $line | while IFS="," read -r name depth sibs user pass addr op_dir y_fingerprint backrefs
    do
        #echo $fld $name $depth $sibs $user $pass $addr $backrefs
        case "$fld" in 
            name) 
                echo $name
                return 1
            ;;
            depth) 
                echo $depth
                return 1
            ;;
            sibs) 
                echo $sibs
                return 1
            ;;
            user) 
                echo $user
                return 1
            ;;
            pass) 
                echo $pass
                return 1
            ;;
            addr) 
                echo $addr
                return 1
            ;;
            op_dir)
                echo $op_dir
                return 1
            ;;
            y_fingerprint)
                if [ $y_fingerprint == "1" ]; then
                    echo "1"
                else 
                    echo ""
                fi
                return 1
            ;;
            backrefs) 
                echo $backrefs
                return 1
            ;;
            *)
            ;;
        esac
    done
    return 0
}


function depth_of {
    local NODE_NAME=$1
    local GRAPH=$2

    #echo $NODE_NAME     #  while IFS="," read -r id firstname lastname jobtitle email branch state

    echo "$GRAPH" | while IFS="\n" read -r line
    do
        n_name=$(name_field 'name' "$line")
        if [ $NODE_NAME = $n_name ]; then
            depth=$(name_field 'depth' "$line")
            echo $depth
        fi
    done


    return 1
}


function in_string_list {
    local target=$1
    local list=$2

    list=($list)
    #
    ok_val=0
    for matcher in "${list[@]}"
    do
        if [ $matcher = $target ]; then
            ok_val=1
        fi
    done

    return $ok_val
}


function in_back_ref {   # $NODE_NAME" "$line"
    #
    local NODE_NAME=$1
    local line=$2
    #
    brefs=$(name_field 'backrefs' "$line")
    if [ ! -z brefs ]; then
        in_string_list "$NODE_NAME" "$brefs"
        ok=$?
        if [[ $ok == 1 ]]; then
            return 1
        fi 
    fi
    #
    return 0
}


# only greater depth for next nodes
# # only node governed by this node
function subs_of_node {
    local NODE_NAME=$1
    local GRAPH=$2
    local DEPTH=$(depth_of $NODE_NAME "$GRAPH")
    #
    echo "$GRAPH" | while IFS="\n" read -r line
    do
        n_name=$(name_field 'name' "$line")
        if [ $NODE_NAME != $n_name ]; then
            sib_depth=$(name_field 'depth' "$line")
            if [[ $sib_depth > $DEPTH ]]; then
                in_back_ref  "$NODE_NAME" "$line"
                ok=$?
                if [[ $ok == 1 ]]; then
                    echo "$line"
                fi
            fi
        fi
    done
}


function node_description {
    local NODE_NAME=$1
    local GRAPH=$2

    echo "$GRAPH" | while IFS="\n" read -r line
    do
        n_name=$(name_field 'name' "$line")
        if [ $NODE_NAME = $n_name ]; then
            echo "$line"
        fi
    done
}

function limit_graph_to_node {   # $nxt_host $nxt_depth $SIBGRAPH)
    
    local NODE_NAME=$1
    local GRAPH=$2

    node_line=$(node_description $NODE_NAME "$GRAPH")
    subs=$(subs_of_node $NODE_NAME "$GRAPH")
    echo "$node_line"
    echo "$subs"
}

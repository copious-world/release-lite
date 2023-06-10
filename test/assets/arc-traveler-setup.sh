#!/bin/bash
#
#  `'${sib.auth.pass}' ${sib.auth.user} ${sib.host.addr} ${g_hat_str} ${ops}`
#  // node provides e.g. 'dietpi' 'dietpi-pass' '192.168.1.???'
# executes on the next hop and knows the downstream auth. causes next hop nodes to operate
#
#
NODE_NAME=$1        # everthing is the next hop... This file is arrowed in. The previous interface is authroized for the ssh caller.
OP_DIR=$2
GRAPH_STR=$3
OPS_STR=$4
UPLOADER=$5
#
#
#

function print_and_run_lines {

    SAVEIFS=$IFS   # Save current IFS (Internal Field Separator)
    IFS='\n'      # Change IFS to newline char
    OPS=$1
    OPS=($OPS) # split the `names` string into an array by the same name
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
    fld=$1
    line=$2
    echo $line | while IFS="," read -r name depth sibs user pass addr backrefs
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
    NODE_NAME=$1
    GRAPH=$2

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
    target=$1
    list=$2

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
    NODE_NAME=$1
    line=$2
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
    NODE_NAME=$1
    GRAPH=$2
    DEPTH=$(depth_of $NODE_NAME "$GRAPH")
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




#
#
#
#
GRAPH=$(echo $GRAPH_STR | base64 --decode)
OPS=$(echo $OPS_STR | base64 --decode)
#
# LOCAL -- controlled by previous hop
# run the local ops (this script arrowed in from previous hop -- run here with local permission)

pushd $OP_DIR # run ops in this directory
#
print_and_run_lines "$OPS"

# REMOTE -- next hop
# Remove the current ply from the graph  (cut out the current node and anything same or lower depth)

SIBGRAPH=$(subs_of_node  $NODE_NAME "$GRAPH")
SIBG=$(echo "$SIBGRAPH" | base64)   # GRAPH ENCODED


echo ""; echo ""

echo "$SIBGRAPH"


echo ""; echo ""
exit 0

# #
# # Now, given there is a ply left
echo "$SIBGRAPH" | while IFS=$"\n" read -r line; do
    echo "start"
    #
    nxt_host=$(name_field 'name' "$line")          # downstream node host, ip, pass, user
    nxt_ip=$(name_field 'addr' "$line")
    nxt_pass=$(name_field 'pass' "$line")
    nxt_user=$(name_field 'user' "$line")
    #
    echo "bash ./expectpw-ssh-cmd '${nxt_pass}' ${nxt_user} ${nxt_ip} 'mkdir -p $OP_DIR'"
    echo "bash ./${UPLOADER}.sh '${nxt_pass}' ${nxt_user} ${nxt_ip} $OP_DIR"       # operational file ahead of the next action
    #
    echo "bash expectpw-ssh.sh '${nxt_pass}' ${nxt_user} ${nxt_ip} 'arc-traveler-setup.sh' '' '${nxt_host} $OP_DIR $SIBG $OPS_STR ${UPLOADER}' &"
    echo $host
done

popd $OP_DIR

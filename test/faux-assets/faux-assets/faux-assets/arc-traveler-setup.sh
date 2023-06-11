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
    local fld=$1
    local line=$2
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




#
#
#
#
GRAPH=$(echo $GRAPH_STR | base64 --decode)
OPS=$(echo $OPS_STR | base64 --decode)
#
# LOCAL -- controlled by previous hop
# run the local ops (this script arrowed in from previous hop -- run here with local permission)
DEPTH=$(depth_of $NODE_NAME "$GRAPH")
#
echo ""; echo ""
echo "--------- BEGINNING ARC TRAVELER SETUP $NODE_NAME ----${DEPTH}----- "

pushd $OP_DIR # run ops in this directory
cp ../arc-traveler-setup.sh .
#
print_and_run_lines "$OPS"

# REMOTE -- next hop
# Remove the current ply from the graph  (cut out the current node and anything same or lower depth)


SIBGRAPH=$(subs_of_node  $NODE_NAME "$GRAPH")
SIBG=$(echo "$SIBGRAPH" | base64)   # GRAPH ENCODED

echo ""; echo ""
echo "--------- BEGIN ======= GRAPH ---$NODE_NAME------ " ${#GRAPH}

echo "$GRAPH"

echo "<<<<<<<--------- END ======= GRAPH --------- "

echo ""; echo ""

echo ""; echo ""
echo "--------- BEGIN SIBLING GRAPH ---$NODE_NAME------ " ${#SIBGRAPH}

echo "$SIBGRAPH"

echo "<<<<<<<--------- END SIBLING GRAPH --------- "

echo ""; echo ""

UPDEPTH=$((DEPTH+1))

# #
# # Now, given there is a ply left
sibsize=${#SIBGRAPH}
if [[ $sibsize > 0 ]]; then 
    echo "$SIBGRAPH" | while IFS=$"\n" read -r line; do
        #
        nxt_depth=$(name_field 'depth' "$line") 
        if [[ $UPDEPTH == $nxt_depth ]]; then
            #
            nxt_host=$(name_field 'name' "$line")          # downstream node host, ip, pass, user
            nxt_ip=$(name_field 'addr' "$line")
            nxt_pass=$(name_field 'pass' "$line")
            nxt_user=$(name_field 'user' "$line")
            #
            echo "START --> $nxt_host $nxt_ip"
            #
            bash ./expectpw-ssh-cmd.sh "${nxt_pass}" ${nxt_user} ${nxt_ip} "mkdir -p $OP_DIR"
            bash ./${UPLOADER}.sh "${nxt_pass}" ${nxt_user} ${nxt_ip} $OP_DIR      # operational file ahead of the next action
            #
            bash ./expectpw-ssh.sh "${nxt_pass}" ${nxt_user} ${nxt_ip} arc-traveler-setup.sh "${nxt_host} $OP_DIR $SIBG $OPS_STR ${UPLOADER}" #&
            echo "done: $nxt_host "
        fi
    done
fi

popd $OP_DIR


echo "--------- ENDING ARC TRAVELER SETUP $NODE_NAME --------- "
echo ""; echo ""

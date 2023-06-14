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
. ./arc-utils.sh
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
cp ../arc-utils.sh .
#
print_and_run_lines "$OPS"

# REMOTE -- next hop
# Remove the current ply from the graph  (cut out the current node and anything same or lower depth)


SIBGRAPH=$(subs_of_node  $NODE_NAME "$GRAPH")

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
echo "START --> $nxt_host $nxt_ip  $sibsize"
            #
            bash ./expectpw-ssh-cmd.sh "${nxt_pass}" ${nxt_user} ${nxt_ip} "mkdir -p $OP_DIR"
            bash ./${UPLOADER}.sh "${nxt_pass}" ${nxt_user} ${nxt_ip} $OP_DIR      # operational file ahead of the next action
            #

            nxt_SIBGRAPH=$(limit_graph_to_node $nxt_host "$SIBGRAPH")

# echo " SUBG BEGIN nxt_SIBGRAP"
# echo "$nxt_SIBGRAPH"
# echo " SUBG END nxt_SIBGRAP"


            SIBG=$(echo "$nxt_SIBGRAPH" | base64)   # GRAPH ENCODED
            #
            bash ./expectpw-ssh.sh "${nxt_pass}" ${nxt_user} ${nxt_ip} arc-traveler-setup.sh "${nxt_host} $OP_DIR $SIBG $OPS_STR ${UPLOADER}" &
            echo "done: $nxt_host "
        fi
    done
fi

popd $OP_DIR


echo "--------- ENDING ARC TRAVELER SETUP $NODE_NAME --------- "
echo ""; echo ""

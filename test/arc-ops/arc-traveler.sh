#!/bin/bash
#
#  `'${sib.auth.pass}' ${sib.auth.user} ${sib.host.addr} ${g_hat_str} ${ops}`
#  // node provides e.g. 'dietpi' 'dietpi-pass' '192.168.1.???'
# executes on the next hop and knows the downstream auth. causes next hop nodes to operate
#
#
#
. ./arc-utils.sh
#
#
#
NODE_NAME=$1        # everthing is the next hop... This file is arrowed in. The previous interface is authroized for the ssh caller.
OP_DIR=$2
GRAPH_STR=$3
OPS_STR=$4
POST_OPS_STR=$5
#

#
GRAPH=$(echo $GRAPH_STR | base64 --decode)
OPS=$(echo $OPS_STR | base64 --decode)
POST_OPS=$(echo $POST_OPS_STR | base64 --decode)
#
# LOCAL -- controlled by previous hop
# run the local ops (this script arrowed in from previous hop -- run here with local permission)

echo ""; echo ""
echo "--------- BEGINNING ARC TRAVELER $NODE_NAME ----${DEPTH}----- "

pushd $OP_DIR # run ops in this directory
cp ../arc-traveler.sh .
cp ../arc-utils.sh .
#
print_and_run_lines "$OPS"                  #-----------


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
        nxt_depth=$(name_field 'depth' "$line") 
        if [[ $UPDEPTH == $nxt_depth ]]; then
            #
            nxt_host=$(name_field 'name' "$line")          # downstream node host, ip, pass, user
            nxt_ip=$(name_field 'addr' "$line")
            nxt_pass=$(name_field 'pass' "$line")
            nxt_user=$(name_field 'user' "$line")
            #
echo "START --> $nxt_host $nxt_ip  $sibsize"
            nxt_upload_scriptstr=$(name_field 'upload_scripts' "$line")
            nxt_upload_scriptstr=$(echo "$nxt_upload_scriptstr" | base64 --decode )
            #
            echo "$nxt_upload_scriptsr"| while IFS=$"\n" read -r script; do
                bash './expectpw-scp-helper.sh', '${nxt_pass}' ${nxt_user} ${nxt_ip}, "${script}", $OP_DIR
            done
            #
            nxt_download_scriptstr=$(name_field 'download_scripts' "$line")
            nxt_download_scriptstr=$(echo "$nxt_download_scriptstr" | base64 --decode )
            #
            echo "$nxt_download_scriptstr"| while IFS=$"\n" read -r script; do
                bash './expectpw-scp-fetch-helper.sh', '${nxt_pass}' ${nxt_user} ${nxt_ip}, "${script}", $OP_DIR
            done
            #
            OPS_STR=$(name_field 'ops' "$line") # operation list already  ENCODED
            OPS_STR=$(echo $nxt_OPS | base64)   
            #
            POST_OPS_STR=$(name_field 'post_ops' "$line") # post operation list already  ENCODED

            nxt_SIBGRAPH=$(limit_graph_to_node $nxt_host "$SIBGRAPH")
            SIBG=$(echo "$nxt_SIBGRAPH" | base64)   # GRAPH ENCODED
            #
            bash ./expectpw-ssh.sh '${nxt_pass}' ${nxt_user} ${nxt_ip} arc-traveler-setup.sh "${nxt_host} $OP_DIR $SIBG $OPS_STR $POST_OPS_STR" &
            echo "done: $nxt_host"
        fi
    done
fi


#
# LOCAL OPERATIONS --  AFTER propagating files, etc.
print_and_run_lines "$POST_OPS"

popd $OP_DIR


echo "ENDING ARC TRAVELER $NODE_NAME"


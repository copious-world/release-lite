#
#  `'${sib.auth.pass}' ${sib.auth.user} ${sib.host.addr} ${g_hat_str} ${ops}`
#  // node provides e.g. 'dietpi' 'dietpi-pass' '192.168.1.???'
# executes on the next hop and knows the downstream auth. causes next hop nodes to operate
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


#
NODE_NAME=$1        # everthing is the next hop... This file is arrowed in. The previous interface is authroized for the ssh caller.
OP_DIR=$2
GRAPH_STR=$3
OPS_STR=$4
POST_OPS_STR=$5
#
echo "BEGINNING ARC TRAVELER $NODE_NAME"
#
GRAPH=$(echo $GRAPH_STR | base64 --decode)
OPS=$(echo $OPS_STR | base64 --decode)
#
# LOCAL -- controlled by previous hop
# run the local ops (this script arrowed in from previous hop -- run here with local permission)

pushd $OP_DIR
#
#
print_and_run_lines "$OPS"

# REMOTE -- next hop
# Remove the current ply from the graph  (cut out the current node and anything same or lower depth)
DEPTH=$(echo $GRAPH | jq 'getpath(["$NODE_NAME","depth"])')
# only greater depth for next nodes
SIBGRAPH=$(echo $GRAPH | jq  -c 'to_entries | select(.value.depth > $DEPTH) | from_entries' )
# only node governed by this node
SIBGRAPH=$(echo $SIBGRAPH | jq  -c 'to_entries | select( .value.backrefs has("$NODE_NAME") ) | from_entries' )
SIBG=$(base64 $SIBGRAPH)   # GRAPH ENCODED
#
# Now, given there is a ply left
echo "$SIBGRAPH" | jq -c '.[]' |
while IFS=$"\n" read -r c; do
    #
    nxt_host=$(echo "$c" | jq -r '.host.abbr')          # downstream node host, ip, pass, user
    nxt_ip=$(echo "$c" | jq -r '.host.addr')
    nxt_pass=$(echo "$c" | jq -r '.auth.pass')
    nxt_user=$(echo "$c" | jq -r '.auth.user')
    #
    echo "START --> $nxt_host $nxt_ip"
    #
    echo "$c" | jq -c '.upload_scripts' |
    while IFS=$"\n" read -r script; do
        bash './expectpw-scp-helper.sh', '${nxt_pass}' ${nxt_user} ${nxt_ip}, '${script}', $OP_DIR
    done
    #
    echo "$c" | jq -c '.download_files' |
    while IFS=$"\n" read -r script; do
        bash './expectpw-scp-fetch-helper.sh', '${nxt_pass}' ${nxt_user} ${nxt_ip}, '${script}', $OP_DIR
    done
    #
    SIBG=$(base64 $SIBGRAPH)   # GRAPH ENCODED
    OPS=$(echo "$c" | jq -r '.required_on_node_operations')
    OPS_STR=$(base64 $OPS)   # operation list ENCODED
    #
    R_POST_OPS=$(echo "$c" | jq -r '.required_on_node_post_operations')
    POST_OPS_STR=$(base64 $R_POST_OPS)   # operation list ENCODED
    #
    bash expectpw-ssh.sh '${nxt_pass}' ${nxt_user} ${nxt_ip} 'arc-traveler.sh' '' '${nxt_host} $OP_DIR $SIBG $OPS_STR $POST_OPS_STR' #&
    echo "done: $nxt_host "
done

#
# LOCAL OPERATIONS --  AFTER propagating files, etc.
print_and_run_lines "$POST_OPS"


popd $OP_DIR


echo "ENDING ARC TRAVELER $NODE_NAME"


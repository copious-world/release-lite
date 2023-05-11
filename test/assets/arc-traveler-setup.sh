#
#  `'${sib.auth.pass}' ${sib.auth.user} ${sib.host.addr} ${g_hat_str} ${ops}`
#  // node provides e.g. 'dietpi' 'dietpi-pass' '192.168.1.???'
# executes on the next hop and knows the downstream auth. causes next hop nodes to operate
#
NODE_NAME=$1        # everthing is the next hop... This file is arrowed in. The previous interface is authroized for the ssh caller.
OP_DIR=$2
GRAPH_STR=$3
OPS_STR=$4
UPLOADER=$5
#
OPS=$(bas64 --decode $OPS_STR)
GRAPH=$(bas64 --decode $GRAPH_STR)
#
# LOCAL -- controlled by previous hop
# run the local ops (this script arrowed in from previous hop -- run here with local permission)

pushd $OP_DIR
echo $OPS | jq -c '.[]' |
while IFS=$"\n" read -r c; do
    echo "$c"
    bash ${c}
done

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
    echo "start"
    nxt_host=$(echo "$c" | jq -r '.host.abbr')          # downstream node host, ip, pass, user
    nxt_ip=$(echo "$c" | jq -r '.host.addr')
    nxt_pass=$(echo "$c" | jq -r '.auth.pass')
    nxt_user=$(echo "$c" | jq -r '.auth.user')
    #
    bash ./expectpw-ssh-cmd '${nxt_pass}' ${nxt_user} ${nxt_ip} 'mkdir -p $OP_DIR'
    bash ./${UPLOADER}.sh '${nxt_pass}' ${nxt_user} ${nxt_ip} $OP_DIR        # operational file ahead of the next action
    #
    SIBG=$(base64 $SIBGRAPH)   # GRAPH ENCODED
    #
    bash expectpw-ssh.sh '${nxt_pass}' ${nxt_user} ${nxt_ip} 'arc-traveler-setup.sh' '' '${nxt_host} $OP_DIR $SIBG $OPS_STR ${UPLOADER}' &
    echo $host
done

popd $OP_DIR

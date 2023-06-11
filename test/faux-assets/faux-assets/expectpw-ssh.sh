

nxt_pass=$1
nxt_user=$2
nxt_ip=$3
op=$4
params=$5


#'${nxt_pass}' ${nxt_user} ${nxt_ip} 'arc-traveler-setup.sh' 'none' "${nxt_host} $OP_DIR $SIBG $OPS_STR ${UPLOADER}"


# NODE_NAME=$1        # everthing is the next hop... This file is arrowed in. The previous interface is authroized for the ssh caller.
# OP_DIR=$2
# GRAPH_STR=$3
# OPS_STR=$4
# UPLOADER=$5

pass=$(echo $nxt_pass | base64 --decode)




echo  "-------------------------------->>        expectpw-ssh.sh:  " $pass $nxt_user $nxt_ip  \'$op\'  \'$params \'
pwd
ls -l
bash ${op} $params



plist=($params)
NODE_NAME=${plist[0]}
OP_DIR=${plist[1]}
GRAPH_STR=${plist[2]}
OPS_STR=${plist[3]}
UPLOADER=${plist[4]}
#
echo "-" $NODE_NAME "-" 
echo "-" $OP_DIR "-"
echo "-"  $(echo $GRAPH_STR | base64 --decode) "-"
echo "-" $(echo $OPS_STR | base64 --decode) "-"
echo "-" $UPLOADER "-"

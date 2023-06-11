

nxt_pass=$1
nxt_user=$2
nxt_ip=$3
OP_DIR=$4


cp ./*.sh ./$OP_DIR/

pass=$(echo $nxt_pass | base64 --decode)

echo  "-------------------------   CUSTOM UPLOADER:  " $pass $nxt_user $nxt_ip  $OP_DIR


# ${nxt_pass} ${nxt_user} ${nxt_ip} 'mkdir -p $OP_DIR'


nxt_pass=$1
nxt_user=$2
nxt_ip=$3
op=$4

pass=$(echo $nxt_pass | base64 --decode)

echo  "expectpw-ssh-cmd.sh:  " $pass $nxt_user $nxt_ip  \'$op\'
${op}

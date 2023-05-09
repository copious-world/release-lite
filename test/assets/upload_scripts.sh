#
PASS=$1
USER=$2
IP=$3
OP_DIR=$4
#
bash './expectpw-scp-helper.sh', $PASS, $USER, $IP, 'apt-installer.sh', $OP_DIR
bash './expectpw-scp-helper.sh', $PASS, $USER, $IP, 'expectpw-ssh-cmd.sh', $OP_DIR
bash './expectpw-scp-helper.sh', $PASS, $USER, $IP, 'expectpw-upload_scripts.sh', $OP_DIR
 #
 #
 
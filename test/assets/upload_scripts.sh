#
PASS=$1
USER=$2
IP=$3
OP_DIR=$4
#
bash './expectpw-scp-helper.sh', $PASS, $USER, $IP, 'expectpw-scp-helper.sh', $OP_DIR
bash './expectpw-scp-helper.sh', $PASS, $USER, $IP, 'apt-installer.sh', $OP_DIR
bash './expectpw-scp-helper.sh', $PASS, $USER, $IP, 'expectpw-ssh-cmd.sh', $OP_DIR
bash './expectpw-scp-helper.sh', $PASS, $USER, $IP, 'expectpw-ssh.sh', $OP_DIR
bash './expectpw-scp-helper.sh', $PASS, $USER, $IP, 'upload_scripts.sh', $OP_DIR
bash './expectpw-scp-helper.sh', $PASS, $USER, $IP, 'arc-traveler.sh', $OP_DIR
bash './expectpw-scp-helper.sh', $PASS, $USER, $IP, 'arc-traveler-setup.sh', $OP_DIR
#
#
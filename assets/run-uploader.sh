UPAR=$1
ADDR=$2
ssh $UPAR@$ADDR 'bash -s' < ./controller_put_ssh.sh

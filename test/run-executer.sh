UPAR=$1
ADDR=$2
ssh $UPAR@$ADDR 'bash -s' < ./controller_exec_ssh.sh
scp $UPAR@$ADDR:/home/naming/name_run.out .
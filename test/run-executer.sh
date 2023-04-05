UPAR=$1
ADDR=$2
BASHFILE=$3
ssh $UPAR@$ADDR 'bash -s' < ./$BASHFILE
scp $UPAR@$ADDR:/home/naming/name_run.out .

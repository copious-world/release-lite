UPAR=$1
ADDR=$2
MASTER_BASHFILE=$3
MASTER_DIR=$4
#
pushd $MASTER_DIR






popd






ssh $UPAR@$ADDR 'bash -s' < ./$BASHFILE
scp $UPAR@$ADDR:/home/naming/name_run.out .

# host-exec.sh richard 76.229.181.242 host-setup.sh /home/richard/distro-op

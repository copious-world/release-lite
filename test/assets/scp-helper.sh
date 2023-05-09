
USR=$1
ADDR=$2
FILE=$3
REMOTE_DIR=$4
if [ -z $REMOTE_DIR ]; then
    scp ./$FILE $USR@$ADDR:/home/naming/
else
    scp ./$FILE $USR@$ADDR:$REMOTE_DIR
fi

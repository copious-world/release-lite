USR=$1
ADDR=$2
FILE=$3
ssh $USR@$ADDR 'bash -s' < $FILE

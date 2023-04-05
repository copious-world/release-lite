
USR=$1
ADDR=$2
DIR=$3
scp $USR@$ADDR:/home/naming/$DIR/* ./$DIR/

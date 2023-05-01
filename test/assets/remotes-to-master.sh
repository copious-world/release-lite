M_MASTER_USER=$1
M_MASTER_ADDR=$2
M_EXEC_DIR=$3
#
ssh ${M_MASTER_USER}@${M_MASTER_ADDR} 'mdir -p ${M_EXEC_DIR}'
scp ./scripts/master/upload/* ${M_MASTER_USER}@${M_MASTER_ADDR}:${M_EXEC_DIR}
scp ./scripts/remote/* ${M_MASTER_USER}@${M_MASTER_ADDR}:${M_EXEC_DIR}
